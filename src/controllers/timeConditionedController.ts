import { Request, Response } from "express";
import { ExamCategory, ExamStatus } from "../generated/prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { getNextLectureForStudentItem } from "./weeklyLecturesController";
import {
  nextTimeConditionedItemResponseSchema,
  timeConditionedExamItemSchema,
  TimeConditionedItemType,
  timeConditionedItemsResponseSchema,
} from "../validators/timeConditionedItems";

type AuthUser = { id: number | string; role: string };
type TimeStatus = "finished" | "ongoing" | "upcoming";
type ExamScheduleStatus = "finished" | "today" | "upcoming";
type SlotWindow = {
  slotStart: Date;
  slotEnd: Date;
};

const lectureInclude = {
  course: { select: { id: true, name: true, course_type: true } },
  location: { select: { id: true, name: true } },
  instructor: { select: { id: true, full_name: true, role: true } },
  group: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  major: { select: { id: true, name: true } },
};

const WEEKDAY_BY_JS_DAY = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

function getAuthUser(req: Request): { userId: number; role: string } {
  const { id, role } = req.user as AuthUser;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ForbiddenError("Invalid authenticated user");
  }

  return { userId, role };
}

function dateOnly(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateOnlyFromStoredDate(date: Date) {
  const result = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  result.setHours(0, 0, 0, 0);
  return result;
}

function storedDateForLocalDay(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractDays(date: Date, days: number) {
  const result = dateOnly(date);
  result.setDate(result.getDate() - days);
  return result;
}

function getExamDateTime(date: Date, time: string) {
  const [hour, minute, second] = time.split(":").map(Number);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return new Date(date);
  }

  const result = dateOnlyFromStoredDate(date);
  result.setHours(hour, minute, Number.isInteger(second) ? second : 0, 0);
  return result;
}

function getExamStartDateTime(date: Date, startTime: string) {
  return getExamDateTime(date, startTime);
}

function getExamEndDateTime(date: Date, endTime: string) {
  return getExamDateTime(date, endTime);
}

function getLectureItemStatus(now: Date, window: SlotWindow): TimeStatus {
  if (now > window.slotEnd) return "finished";
  if (now >= window.slotStart && now <= window.slotEnd) return "ongoing";
  return "upcoming";
}

function getExamItemStatus(
  now: Date,
  today: Date,
  date: Date,
  endTime: string,
): ExamScheduleStatus {
  if (getExamEndDateTime(date, endTime) < now) return "finished";
  if (dateOnlyFromStoredDate(date).getTime() === today.getTime()) return "today";
  return "upcoming";
}

async function getTimingSettings() {
  const settings = await prisma.systemSettings.findFirst();

  if (!settings?.lectures_start_time || !settings?.lecture_duration) {
    throw new BadRequestError(
      "System settings are missing lecture_duration or lectures_start_time",
    );
  }

  const [startHour, startMin] = settings.lectures_start_time
    .split(":")
    .map(Number);

  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(startMin) ||
    !Number.isInteger(settings.lecture_duration)
  ) {
    throw new BadRequestError("System lecture timing configuration is invalid");
  }

  return {
    startHour,
    startMin,
    duration: settings.lecture_duration,
  };
}

async function computeSlotWindow(
  lectureDate: Date,
  timeBoxOrder: number,
): Promise<SlotWindow> {
  const { startHour, startMin, duration } = await getTimingSettings();

  const slotStart = dateOnlyFromStoredDate(lectureDate);
  slotStart.setHours(startHour, startMin + (timeBoxOrder - 1) * duration, 0, 0);

  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + duration);

  return { slotStart, slotEnd };
}

async function getStudent(userId: number) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      student_id: true,
      section_id: true,
      major_id: true,
      group_id: true,
      courses: {
        select: {
          course_id: true,
        },
      },
    },
  });

  if (!student) throw new NotFoundError("Student");

  return student;
}

function getStudentLectureTargetRules(student: Awaited<ReturnType<typeof getStudent>>) {
  const courseIds = student.courses.map((course) => course.course_id);

  if (courseIds.length === 0) {
    return [];
  }

  const courseFilter = { in: courseIds };
  const targetRules: Record<string, unknown>[] = [
    {
      lecture_type: "PRACTICAL",
      group_id: student.group_id,
      course_id: courseFilter,
    },
  ];

  if (student.section_id) {
    targetRules.push({
      lecture_type: "THEORETICAL",
      section_id: student.section_id,
      course_id: courseFilter,
    });
  }

  if (student.major_id) {
    targetRules.push({
      lecture_type: "THEORETICAL",
      major_id: student.major_id,
      course_id: courseFilter,
    });
  }

  return targetRules;
}

function getExamCategory(itemType: TimeConditionedItemType) {
  return itemType === "practical_exam"
    ? ExamCategory.PRACTICAL
    : ExamCategory.THEORETICAL;
}

function toExamItem(setting: {
  id: number;
  exam_id: number;
  date: Date;
  start_time: string;
  end_time: string;
  location: {
    id: number;
    name: string;
    reaching_description: string | null;
  } | null;
  exam: {
    id: number;
    type: ExamCategory;
    status: ExamStatus;
    course_id: number;
    course: {
      id: number;
      name: string;
      code: string | null;
      image: string | null;
    };
  };
}) {
  return timeConditionedExamItemSchema.parse({
    id: setting.exam.id,
    type: setting.exam.type,
    status: setting.exam.status,
    course_id: setting.exam.course_id,
    course: setting.exam.course,
    setting: {
      id: setting.id,
      exam_id: setting.exam_id,
      date: setting.date,
      start_time: setting.start_time,
      end_time: setting.end_time,
      location: setting.location,
    },
  });
}

async function getExamScheduleItems(userId: number, examType: ExamCategory) {
  const student = await getStudent(userId);
  const courseIds = student.courses.map((course) => course.course_id);

  if (courseIds.length === 0) {
    return [];
  }

  const now = new Date();
  const today = dateOnly(now);

  const settings = await prisma.examSettings.findMany({
    where: {
      students: {
        some: {
          student_id: student.student_id,
        },
      },
      exam: {
        type: examType,
        status: { in: [ExamStatus.READY, ExamStatus.PUBLISHED] },
        course_id: { in: courseIds },
      },
    },
    select: {
      id: true,
      exam_id: true,
      date: true,
      start_time: true,
      end_time: true,
      location: {
        select: {
          id: true,
          name: true,
          reaching_description: true,
        },
      },
      exam: {
        select: {
          id: true,
          type: true,
          status: true,
          course_id: true,
          course: {
            select: {
              id: true,
              name: true,
              code: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });

  return settings.map((setting) => ({
    ...toExamItem(setting),
    item_status: getExamItemStatus(now, today, setting.date, setting.end_time),
  }));
}

async function getNextExamItem(userId: number, examType: ExamCategory) {
  const student = await getStudent(userId);
  const courseIds = student.courses.map((course) => course.course_id);

  if (courseIds.length === 0) {
    return null;
  }

  const now = new Date();
  const today = dateOnly(now);

  const settings = await prisma.examSettings.findMany({
    where: {
      date: { gte: storedDateForLocalDay(today) },
      students: {
        some: {
          student_id: student.student_id,
        },
      },
      exam: {
        type: examType,
        status: { in: [ExamStatus.READY, ExamStatus.PUBLISHED] },
        course_id: { in: courseIds },
      },
    },
    select: {
      id: true,
      exam_id: true,
      date: true,
      start_time: true,
      end_time: true,
      location: {
        select: {
          id: true,
          name: true,
          reaching_description: true,
        },
      },
      exam: {
        select: {
          id: true,
          type: true,
          status: true,
          course_id: true,
          course: {
            select: {
              id: true,
              name: true,
              code: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });

  const nextSetting = settings.find(
    (setting) => getExamStartDateTime(setting.date, setting.start_time) >= now,
  );

  if (!nextSetting) {
    return null;
  }

  return toExamItem(nextSetting);
}

async function getCurrentItemType(): Promise<TimeConditionedItemType> {
  const settings = await prisma.systemSettings.findFirst({
    select: {
      practical_exam_date: true,
      theoretical_exam_date: true,
    },
  });

  if (!settings?.practical_exam_date || !settings?.theoretical_exam_date) {
    return "lecture";
  }

  const today = dateOnly(new Date());
  const practicalThreshold = subtractDays(settings.practical_exam_date, 7);
  const theoreticalThreshold = subtractDays(settings.theoretical_exam_date, 7);

  if (today < practicalThreshold) {
    return "lecture";
  }

  if (today < theoreticalThreshold) {
    return "practical_exam";
  }

  return "theoretical_exam";
}

async function getNextItemData(req: Request) {
  const { userId, role } = getAuthUser(req);

  if (role !== "STUDENT") {
    throw new ForbiddenError("Only students can access this endpoint");
  }

  const itemType = await getCurrentItemType();

  if (itemType === "lecture") {
    const item = await getNextLectureForStudentItem(req);
    return nextTimeConditionedItemResponseSchema.parse({
      item_type: itemType,
      item,
    });
  }

  const item = await getNextExamItem(userId, getExamCategory(itemType));

  return nextTimeConditionedItemResponseSchema.parse({
    item_type: itemType,
    item,
  });
}

async function getMiniLectureSchedule(userId: number) {
  const student = await getStudent(userId);
  const targetRules = getStudentLectureTargetRules(student);
  const now = new Date();
  const today = dateOnly(now);

  if (targetRules.length === 0) {
    return {
      day: null,
      items: [],
    };
  }

  const weeklyLectures = await prisma.weeklyLecture.findMany({
    where: {
      lecture_date: { gte: storedDateForLocalDay(today) },
      status: { not: "CANCELLED" },
      lecture: { OR: targetRules },
    },
    include: {
      lecture: { include: lectureInclude },
    },
    orderBy: [{ lecture_date: "asc" }, { lecture: { time_box_order: "asc" } }],
  });

  const lecturesWithTiming = await Promise.all(
    weeklyLectures
      .filter((weeklyLecture) => weeklyLecture.status !== "CANCELLED")
      .map(async (weeklyLecture) => {
        const slotWindow = await computeSlotWindow(
          weeklyLecture.lecture_date,
          weeklyLecture.lecture.time_box_order,
        );

        return {
          weeklyLecture,
          slotWindow,
          dayStart: dateOnlyFromStoredDate(weeklyLecture.lecture_date),
          itemStatus: getLectureItemStatus(now, slotWindow),
        };
      }),
  );

  const nextActiveLecture = lecturesWithTiming.find(
    (item) => item.itemStatus !== "finished",
  );

  if (!nextActiveLecture) {
    return {
      day: null,
      items: [],
    };
  }

  const scheduleDayStart = nextActiveLecture.dayStart;
  const scheduleDayKey = dateKey(scheduleDayStart);
  const dayLectures = lecturesWithTiming.filter(
    (item) => dateKey(item.dayStart) === scheduleDayKey,
  );

  const items = dayLectures.map(
    ({ weeklyLecture, slotWindow, itemStatus }) => ({
      ...weeklyLecture,
      slot_start: slotWindow.slotStart.toISOString(),
      slot_end: slotWindow.slotEnd.toISOString(),
      item_status: itemStatus,
    }),
  );

  return {
    day: {
      name: WEEKDAY_BY_JS_DAY[scheduleDayStart.getDay()],
      date: scheduleDayStart,
    },
    items,
  };
}

async function getStudentLecturesSchedule(userId: number) {
  const student = await getStudent(userId);
  const targetRules = getStudentLectureTargetRules(student);

  return prisma.lecture.findMany({
    where: { OR: targetRules },
    include: lectureInclude,
    orderBy: [{ day: "asc" }, { time_box_order: "asc" }],
  });
}

async function getMiniScheduleData(req: Request) {
  const { userId, role } = getAuthUser(req);

  if (role !== "STUDENT") {
    throw new ForbiddenError("Only students can access this endpoint");
  }

  const itemType = await getCurrentItemType();

  if (itemType === "lecture") {
    const { day, items } = await getMiniLectureSchedule(userId);

    return timeConditionedItemsResponseSchema.parse({
      item_type: itemType,
      day,
      items,
    });
  }

  const items = await getExamScheduleItems(userId, getExamCategory(itemType));

  return timeConditionedItemsResponseSchema.parse({
    item_type: itemType,
    items,
  });
}

async function getScheduleData(req: Request) {
  const { userId, role } = getAuthUser(req);

  if (role !== "STUDENT") {
    throw new ForbiddenError("Only students can access this endpoint");
  }

  const itemType = await getCurrentItemType();

  if (itemType === "lecture") {
    const items = await getStudentLecturesSchedule(userId);

    return timeConditionedItemsResponseSchema.parse({
      item_type: itemType,
      items,
    });
  }

  const items = await getExamScheduleItems(userId, getExamCategory(itemType));

  return timeConditionedItemsResponseSchema.parse({
    item_type: itemType,
    items,
  });
}

export const getNextItem = asyncHandler(async (req: Request, res: Response) => {
  const data = await getNextItemData(req);

  return res.status(200).json({
    success: true,
    data,
  });
});

export const getMiniSchedule = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getMiniScheduleData(req);

    return res.status(200).json({
      success: true,
      data,
    });
  },
);

export const getSchedule = asyncHandler(async (req: Request, res: Response) => {
  const data = await getScheduleData(req);

  return res.status(200).json({
    success: true,
    data,
  });
});
