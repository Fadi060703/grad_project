import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors";
import { generateWeeklyLectures } from "../lib/generateWeeklyLectures";
import { v4 as uuidv4 } from "uuid";

const lectureInclude = {
  course: { select: { id: true, name: true, course_type: true } },
  location: { select: { id: true, name: true } },
  instructor: { select: { id: true, full_name: true, role: true } },
  group: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  major: { select: { id: true, name: true } },
};

type AuthUser = { id: number | string; role: string };

type SlotWindow = {
  slotStart: Date;
  slotEnd: Date;
};

function getAuthUser(req: Request): { userId: number; role: string } {
  const { id, role } = req.user as AuthUser;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ForbiddenError("Invalid authenticated user");
  }

  return { userId, role };
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

  const slotStart = new Date(lectureDate);
  slotStart.setHours(startHour, startMin + (timeBoxOrder - 1) * duration, 0, 0);

  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + duration);

  return { slotStart, slotEnd };
}

function isOngoing(now: Date, window: SlotWindow) {
  return now >= window.slotStart && now <= window.slotEnd;
}

function hasEnded(now: Date, window: SlotWindow) {
  return now > window.slotEnd;
}

function hasStarted(now: Date, window: SlotWindow) {
  return now >= window.slotStart;
}

function withTiming<T extends { lecture: { time_box_order: number }; lecture_date: Date }>(
  weeklyLecture: T,
  window: SlotWindow,
  extra: Record<string, unknown> = {},
) {
  return {
    ...weeklyLecture,
    slot_start: window.slotStart.toISOString(),
    slot_end: window.slotEnd.toISOString(),
    ...extra,
  };
}

async function findNextWeeklyLecture(whereClause: Record<string, unknown>) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const candidates = await prisma.weeklyLecture.findMany({
    where: {
      lecture_date: { gte: today },
      status: { not: "CANCELLED" },
      ...whereClause,
    },
    include: {
      lecture: { include: lectureInclude },
    },
    orderBy: [{ lecture_date: "asc" }, { lecture: { time_box_order: "asc" } }],
  });

  for (const wl of candidates) {
    const window = await computeSlotWindow(
      wl.lecture_date,
      wl.lecture.time_box_order,
    );

    if (isOngoing(now, window)) {
      return { weeklyLecture: wl, slotWindow: window, isOngoing: true };
    }
  }

  for (const wl of candidates) {
    const window = await computeSlotWindow(
      wl.lecture_date,
      wl.lecture.time_box_order,
    );

    if (!hasEnded(now, window)) {
      return { weeklyLecture: wl, slotWindow: window, isOngoing: false };
    }
  }

  return null;
}

function getInstructorFlags(props: {
  role: string;
  lectureType: string;
  status: string;
  slotWindow: SlotWindow;
}) {
  const now = new Date();
  const { role, lectureType, status, slotWindow } = props;

  const canPublish =
    role === "TEACHER" &&
    lectureType === "PRACTICAL" &&
    status !== "CANCELLED" &&
    isOngoing(now, slotWindow);

  const canCancel =
    status !== "PUBLISHED" &&
    !hasStarted(now, slotWindow) &&
    ((role === "TEACHER" && lectureType === "PRACTICAL") ||
      (role === "DOCTOR" && lectureType === "THEORETICAL"));

  return {
    can_publish: canPublish,
    can_cancel: canCancel && status === "DRAFT",
    can_restore: canCancel && status === "CANCELLED",
  };
}

async function createAttendanceRowsForLectureGroup(
  tx: any,
  weeklyLectureId: number,
  groupId: number,
) {
  const students = await tx.student.findMany({
    where: { group_id: groupId },
    select: { student_id: true },
  });

  if (students.length === 0) {
    return { eligible_students: 0, attendance_records_created: 0 };
  }

  const created = await tx.lectureAttendance.createMany({
    data: students.map((student: { student_id: number }) => ({
      weekly_lecture_id: weeklyLectureId,
      student_id: student.student_id,
      has_attended: false,
    })),
    skipDuplicates: true,
  });

  return {
    eligible_students: students.length,
    attendance_records_created: created.count,
  };
}

function validateInstructorOwnsLecture(
  lecture: { instructor_id: number },
  userId: number,
) {
  if (lecture.instructor_id !== userId) {
    throw new ForbiddenError("You can only manage your own weekly lectures");
  }
}

// POST /cron/generate-weekly-lectures
export const manualGenerateWeeklyLectures = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await generateWeeklyLectures();

    return res.status(200).json({
      success: true,
      message: `${result.created} weekly lectures generated.`,
      data: result,
    });
  },
);

// GET /weekly-lectures/next/student
export async function getNextLectureForStudentItem(req: Request) {
  const { userId, role } = getAuthUser(req);

  if (role !== "STUDENT") throw new ForbiddenError("Only students can access this endpoint");

  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      student_id: true,
      section_id: true,
      major_id: true,
      group_id: true,
    },
  });
  if (!student) throw new NotFoundError("Student");

  const targetRules: Record<string, unknown>[] = [
    {
      lecture_type: "PRACTICAL",
      group_id: student.group_id,
    },
  ];

  if (student.section_id) {
    targetRules.push({
      lecture_type: "THEORETICAL",
      section_id: student.section_id,
    });
  }

  if (student.major_id) {
    targetRules.push({
      lecture_type: "THEORETICAL",
      major_id: student.major_id,
    });
  }

  const result = await findNextWeeklyLecture({
    lecture: { OR: targetRules },
  });

  if (!result) {
    return null;
  }

  const { weeklyLecture, slotWindow, isOngoing: lectureIsOngoing } = result;

  let has_attended: boolean | null = null;
  if (weeklyLecture.lecture.lecture_type === "PRACTICAL") {
    const attendance = await prisma.lectureAttendance.findUnique({
      where: {
        weekly_lecture_id_student_id: {
          weekly_lecture_id: weeklyLecture.id,
          student_id: student.student_id,
        },
      },
    });
    has_attended = attendance?.has_attended ?? false;
  }

  const canScanQr =
    weeklyLecture.lecture.lecture_type === "PRACTICAL" &&
    weeklyLecture.status === "PUBLISHED" &&
    lectureIsOngoing &&
    has_attended !== true;

  return withTiming(weeklyLecture, slotWindow, {
    is_ongoing: lectureIsOngoing,
    has_attended,
    can_scan_qr: canScanQr,
  });
}

export const getNextLectureForStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getNextLectureForStudentItem(req);

    return res.status(200).json({
      success: true,
      data,
    });
  },
);

// GET /weekly-lectures/next/teacher
export const getNextLectureForTeacher = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, role } = getAuthUser(req);

    if (role !== "TEACHER") throw new ForbiddenError("Only teachers can access this endpoint");

    const result = await findNextWeeklyLecture({
      lecture: { instructor_id: userId, lecture_type: "PRACTICAL" },
    });

    if (!result) return res.status(200).json({ success: true, data: null });

    return res.status(200).json({
      success: true,
      data: withTiming(result.weeklyLecture, result.slotWindow, {
        is_ongoing: result.isOngoing,
        ...getInstructorFlags({
          role,
          lectureType: result.weeklyLecture.lecture.lecture_type,
          status: result.weeklyLecture.status,
          slotWindow: result.slotWindow,
        }),
      }),
    });
  },
);

// GET /weekly-lectures/next/doctor
export const getNextLectureForDoctor = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, role } = getAuthUser(req);

    if (role !== "DOCTOR") throw new ForbiddenError("Only doctors can access this endpoint");

    const result = await findNextWeeklyLecture({
      lecture: { instructor_id: userId, lecture_type: "THEORETICAL" },
    });

    if (!result) return res.status(200).json({ success: true, data: null });

    return res.status(200).json({
      success: true,
      data: withTiming(result.weeklyLecture, result.slotWindow, {
        is_ongoing: result.isOngoing,
        ...getInstructorFlags({
          role,
          lectureType: result.weeklyLecture.lecture.lecture_type,
          status: result.weeklyLecture.status,
          slotWindow: result.slotWindow,
        }),
      }),
    });
  },
);

// POST /weekly-lectures/:id/publish
export const publishWeeklyLecture = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, role } = getAuthUser(req);
    if (role !== "TEACHER") throw new ForbiddenError("Only teachers can publish practical lectures");

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid weekly lecture ID");

    const wl = await prisma.weeklyLecture.findUnique({
      where: { id },
      include: { lecture: true },
    });
    if (!wl) throw new NotFoundError("Weekly lecture");

    validateInstructorOwnsLecture(wl.lecture, userId);

    if (wl.lecture.lecture_type !== "PRACTICAL") {
      throw new BadRequestError("Only practical lectures can be published for attendance");
    }

    if (!wl.lecture.group_id) {
      throw new BadRequestError("Practical lecture must have a group before it can be published");
    }

    if (wl.status === "CANCELLED") {
      throw new BadRequestError("Cannot publish a cancelled lecture");
    }

    const now = new Date();
    const slotWindow = await computeSlotWindow(
      wl.lecture_date,
      wl.lecture.time_box_order,
    );

    if (!isOngoing(now, slotWindow)) {
      throw new BadRequestError(
        `QR can only be generated during the lecture window (${slotWindow.slotStart.toISOString()} – ${slotWindow.slotEnd.toISOString()})`,
      );
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      let current = wl;
      let qrString = wl.qr_string;
      let message = "Weekly lecture already published; returning existing QR.";

      if (wl.status === "DRAFT" || !qrString) {
        qrString = qrString ?? uuidv4();
        current = await tx.weeklyLecture.update({
          where: { id },
          data: {
            status: "PUBLISHED",
            qr_string: qrString,
            published_at: wl.published_at ?? now,
          },
          include: { lecture: true },
        });
        message = "Weekly lecture published and QR generated.";
      }

      const attendanceStats = await createAttendanceRowsForLectureGroup(
        tx,
        id,
        wl.lecture.group_id!,
      );

      return { current, message, attendanceStats };
    });

    const updated = await prisma.weeklyLecture.findUnique({
      where: { id },
      include: { lecture: { include: lectureInclude } },
    });

    return res.status(200).json({
      success: true,
      message: transactionResult.message,
      data: withTiming(updated!, slotWindow, {
        is_ongoing: true,
        can_publish: true,
        can_cancel: false,
        ...transactionResult.attendanceStats,
      }),
    });
  },
);

// POST /weekly-lectures/:id/toggle-cancel
export const toggleCancelWeeklyLecture = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, role } = getAuthUser(req);

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid weekly lecture ID");

    const wl = await prisma.weeklyLecture.findUnique({
      where: { id },
      include: { lecture: true },
    });
    if (!wl) throw new NotFoundError("Weekly lecture");

    validateInstructorOwnsLecture(wl.lecture, userId);

    const isTeacherPractical = role === "TEACHER" && wl.lecture.lecture_type === "PRACTICAL";
    const isDoctorTheoretical = role === "DOCTOR" && wl.lecture.lecture_type === "THEORETICAL";

    if (!isTeacherPractical && !isDoctorTheoretical) {
      throw new ForbiddenError(
        "Only the assigned teacher can cancel practical lectures, and only the assigned doctor can cancel theoretical lectures",
      );
    }

    if (wl.status === "PUBLISHED") {
      throw new BadRequestError("Cannot cancel a published lecture");
    }

    const slotWindow = await computeSlotWindow(
      wl.lecture_date,
      wl.lecture.time_box_order,
    );

    if (hasStarted(new Date(), slotWindow)) {
      throw new BadRequestError("Lecture can only be cancelled or restored before its start time");
    }

    const newStatus = wl.status === "CANCELLED" ? "DRAFT" : "CANCELLED";

    const updated = await prisma.weeklyLecture.update({
      where: { id },
      data: { status: newStatus },
      include: { lecture: { include: lectureInclude } },
    });

    return res.status(200).json({
      success: true,
      message: `Weekly lecture ${newStatus === "CANCELLED" ? "cancelled" : "restored to draft"}.`,
      data: withTiming(updated, slotWindow, {
        is_ongoing: false,
        ...getInstructorFlags({
          role,
          lectureType: updated.lecture.lecture_type,
          status: updated.status,
          slotWindow,
        }),
      }),
    });
  },
);

const ATTENDANCE_TEST_DATA = {
  student_id: 1,
  student_user_id: 32,
  group_id: 1,
  section_id: 1,
  teacher_user_id: 13,
  practical_lecture_id: 25,
  doctor_user_id: 2,
  theoretical_lecture_id: 1,
  lecture_duration: 90,
};

const WEEKDAY_BY_JS_DAY: Record<number, "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY"> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
};

function formatTimeForSettings(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dateOnly(date: Date) {
  const result = new Date(date);
  // Prisma/PostgreSQL @db.Date stores only the date part. Using local noon
  // avoids timezone conversion shifting the saved date to the previous day.
  result.setHours(12, 0, 0, 0);
  return result;
}

function addMinutes(date: Date, minutes: number) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function getNextMinutePlusTen() {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 11);
  return start;
}

// TEMPORARY OPEN DEV ENDPOINT — remove before production.
// POST /dev/prepare-attendance-test
export const prepareAttendanceTestData = asyncHandler(
  async (_req: Request, res: Response) => {
    const practicalStart = getNextMinutePlusTen();
    const practicalEnd = addMinutes(
      practicalStart,
      ATTENDANCE_TEST_DATA.lecture_duration,
    );
    const theoreticalStart = practicalEnd;
    const theoreticalEnd = addMinutes(
      theoreticalStart,
      ATTENDANCE_TEST_DATA.lecture_duration,
    );
    const lectureDate = dateOnly(practicalStart);
    const testDay = WEEKDAY_BY_JS_DAY[practicalStart.getDay()];

    const [student, teacher, doctor, practicalLecture, theoreticalLecture] =
      await Promise.all([
        prisma.student.findUnique({
          where: { student_id: ATTENDANCE_TEST_DATA.student_id },
          select: {
            student_id: true,
            userId: true,
            group_id: true,
            section_id: true,
            major_id: true,
          },
        }),
        prisma.user.findUnique({
          where: { id: ATTENDANCE_TEST_DATA.teacher_user_id },
          select: { id: true, role: true, full_name: true },
        }),
        prisma.user.findUnique({
          where: { id: ATTENDANCE_TEST_DATA.doctor_user_id },
          select: { id: true, role: true, full_name: true },
        }),
        prisma.lecture.findUnique({
          where: { id: ATTENDANCE_TEST_DATA.practical_lecture_id },
        }),
        prisma.lecture.findUnique({
          where: { id: ATTENDANCE_TEST_DATA.theoretical_lecture_id },
        }),
      ]);

    if (!student) throw new NotFoundError("Test student");
    if (!teacher) throw new NotFoundError("Test teacher user");
    if (!doctor) throw new NotFoundError("Test doctor user");
    if (!practicalLecture) throw new NotFoundError("Test practical lecture");
    if (!theoreticalLecture) throw new NotFoundError("Test theoretical lecture");

    if (
      student.userId !== ATTENDANCE_TEST_DATA.student_user_id ||
      student.group_id !== ATTENDANCE_TEST_DATA.group_id ||
      student.section_id !== ATTENDANCE_TEST_DATA.section_id
    ) {
      throw new BadRequestError(
        "Test student does not match the configured user_id/group_id/section_id",
      );
    }

    if (teacher.role !== "TEACHER") {
      throw new BadRequestError("Configured teacher user is not a TEACHER");
    }

    if (doctor.role !== "DOCTOR") {
      throw new BadRequestError("Configured doctor user is not a DOCTOR");
    }

    if (
      practicalLecture.lecture_type !== "PRACTICAL" ||
      practicalLecture.instructor_id !== ATTENDANCE_TEST_DATA.teacher_user_id ||
      practicalLecture.group_id !== ATTENDANCE_TEST_DATA.group_id
    ) {
      throw new BadRequestError(
        "Configured practical lecture must be PRACTICAL, assigned to teacher user 13, and target group 1",
      );
    }

    const theoreticalTargetsStudent =
      theoreticalLecture.section_id === student.section_id ||
      (student.major_id !== null && theoreticalLecture.major_id === student.major_id);

    if (
      theoreticalLecture.lecture_type !== "THEORETICAL" ||
      theoreticalLecture.instructor_id !== ATTENDANCE_TEST_DATA.doctor_user_id ||
      !theoreticalTargetsStudent
    ) {
      throw new BadRequestError(
        "Configured theoretical lecture must be THEORETICAL, assigned to doctor user 2, and target the test student's section or major",
      );
    }

    const settingsStartTime = formatTimeForSettings(practicalStart);

    const createdWeeklyLectures = await prisma.$transaction(async (tx) => {
      const settings = await tx.systemSettings.findFirst({ select: { id: true } });

      if (settings) {
        await tx.systemSettings.update({
          where: { id: settings.id },
          data: {
            lectures_start_time: settingsStartTime,
            lecture_duration: ATTENDANCE_TEST_DATA.lecture_duration,
          },
        });
      } else {
        await tx.systemSettings.create({
          data: {
            lectures_start_time: settingsStartTime,
            lecture_duration: ATTENDANCE_TEST_DATA.lecture_duration,
          },
        });
      }

      await tx.weeklyLecture.deleteMany({
        where: {
          lecture_id: {
            in: [
              ATTENDANCE_TEST_DATA.practical_lecture_id,
              ATTENDANCE_TEST_DATA.theoretical_lecture_id,
            ],
          },
          lecture_date: lectureDate,
        },
      });

      await tx.lecture.update({
        where: { id: ATTENDANCE_TEST_DATA.practical_lecture_id },
        data: {
          ...(testDay && { day: testDay }),
          time_box_order: 1,
        },
      });

      await tx.lecture.update({
        where: { id: ATTENDANCE_TEST_DATA.theoretical_lecture_id },
        data: {
          ...(testDay && { day: testDay }),
          time_box_order: 2,
        },
      });

      const practicalWeeklyLecture = await tx.weeklyLecture.create({
        data: {
          lecture_id: ATTENDANCE_TEST_DATA.practical_lecture_id,
          lecture_date: lectureDate,
          status: "DRAFT",
          qr_string: null,
          published_at: null,
        },
        include: { lecture: { include: lectureInclude } },
      });

      const theoreticalWeeklyLecture = await tx.weeklyLecture.create({
        data: {
          lecture_id: ATTENDANCE_TEST_DATA.theoretical_lecture_id,
          lecture_date: lectureDate,
          status: "DRAFT",
          qr_string: null,
          published_at: null,
        },
        include: { lecture: { include: lectureInclude } },
      });

      return { practicalWeeklyLecture, theoreticalWeeklyLecture };
    });

    const { practicalWeeklyLecture, theoreticalWeeklyLecture } = createdWeeklyLectures;

    return res.status(200).json({
      success: true,
      message:
        "Temporary attendance test data prepared. Remove this endpoint before production.",
      data: {
        warning: "OPEN DEV-ONLY ENDPOINT. DO NOT KEEP IN PRODUCTION.",
        system_settings: {
          lectures_start_time: settingsStartTime,
          lecture_duration: ATTENDANCE_TEST_DATA.lecture_duration,
        },
        test_data: ATTENDANCE_TEST_DATA,
        practical: {
          weekly_lecture_id: practicalWeeklyLecture?.id,
          lecture_id: ATTENDANCE_TEST_DATA.practical_lecture_id,
          starts_at: practicalStart.toISOString(),
          ends_at: practicalEnd.toISOString(),
          data: practicalWeeklyLecture,
        },
        theoretical: {
          weekly_lecture_id: theoreticalWeeklyLecture?.id,
          lecture_id: ATTENDANCE_TEST_DATA.theoretical_lecture_id,
          starts_at: theoreticalStart.toISOString(),
          ends_at: theoreticalEnd.toISOString(),
          data: theoreticalWeeklyLecture,
        },
      },
    });
  },
);
