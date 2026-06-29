import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError } from "../errors";
import { generateWeeklyLectures } from "../lib/generateWeeklyLectures";
import { v4 as uuidv4 } from "uuid";

// Shared lecture include
const lectureInclude = {
  course: { select: { id: true, name: true, course_type: true } },
  location: { select: { id: true, name: true } },
  instructor: { select: { id: true, full_name: true, role: true } },
  group: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  major: { select: { id: true, name: true } },
};

// Computes slot start/end times from system settings
// Returns { slotStart: Date, slotEnd: Date } for a given lecture_date + time_box_order
async function computeSlotWindow(lectureDate: Date, timeBoxOrder: number) {
  const settings = await prisma.systemSettings.findFirst();

  if (!settings?.lectures_start_time || !settings?.lecture_duration) {
    throw new BadRequestError(
      "System settings are missing lecture_duration or lectures_start_time",
    );
  }

  // lectures_start_time format: "HH:MM"
  const [startHour, startMin] = settings.lectures_start_time
    .split(":")
    .map(Number);
  const duration = settings.lecture_duration; // in minutes

  const slotStart = new Date(lectureDate);
  slotStart.setHours(startHour, startMin + (timeBoxOrder - 1) * duration, 0, 0);

  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + duration);

  return { slotStart, slotEnd };
}

// Finds the ongoing or next upcoming WeeklyLecture for a given where clause
async function findNextWeeklyLecture(whereClause: object) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Fetch all weekly lectures from today onward, ordered by date then slot
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

  if (candidates.length === 0) return null;

  const settings = await prisma.systemSettings.findFirst();
  if (!settings?.lectures_start_time || !settings?.lecture_duration)
    return null;

  const [startHour, startMin] = settings.lectures_start_time
    .split(":")
    .map(Number);
  const duration = settings.lecture_duration;

  // Check for ongoing first, then fall back to next upcoming
  for (const wl of candidates) {
    const order = wl.lecture.time_box_order;
    const slotStart = new Date(wl.lecture_date);
    slotStart.setHours(startHour, startMin + (order - 1) * duration, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + duration);

    if (now >= slotStart && now <= slotEnd) {
      return { weeklyLecture: wl, isOngoing: true };
    }
  }

  // No ongoing — return the first upcoming
  for (const wl of candidates) {
    const order = wl.lecture.time_box_order;
    const slotStart = new Date(wl.lecture_date);
    slotStart.setHours(startHour, startMin + (order - 1) * duration, 0, 0);

    if (now < slotStart) {
      return { weeklyLecture: wl, isOngoing: false };
    }
  }

  return null;
}

// POST /cron/generate-weekly-lectures
export const manualGenerateWeeklyLectures = asyncHandler(
  async (req: Request, res: Response) => {
    const created = await generateWeeklyLectures();
    return res.status(200).json({
      success: true,
      message: `${created} weekly lectures generated.`,
    });
  },
);

// GET /weekly-lectures/next/student?student_id=x
// export const getNextLectureForStudent = asyncHandler(
//   async (req: Request, res: Response) => {
//     // TODO: replace student_id query param with token payload when auth is implemented
//     const student_id = parseInt(req.query.student_id as string, 10);
//     if (isNaN(student_id)) throw new BadRequestError("Invalid student_id");

//     const student = await prisma.student.findUnique({
//       where: { student_id },
//       select: {
//         student_id: true,
//         section_id: true,
//         major_id: true,
//         group_id: true,
//       },
//     });
//     if (!student) throw new NotFoundError("Student");

//     const whereClause = student.section_id
//       ? { lecture: { section_id: student.section_id } }
//       : { lecture: { major_id: student.major_id } };

//     const result = await findNextWeeklyLecture(whereClause);
//     if (!result) {
//       return res.status(200).json({ success: true, data: null });
//     }

//     const { weeklyLecture, isOngoing } = result;

//     // Get has_attended for this student
//     let has_attended: boolean | null = null;
//     if (weeklyLecture.lecture.lecture_type === "PRACTICAL") {
//       // Only practical lectures have attendance
//       const attendance = await prisma.lectureAttendance.findUnique({
//         where: {
//           weekly_lecture_id_student_id: {
//             weekly_lecture_id: weeklyLecture.id,
//             student_id,
//           },
//         },
//       });
//       has_attended = attendance?.has_attended ?? false;
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         ...weeklyLecture,
//         is_ongoing: isOngoing,
//         has_attended,
//       },
//     });
//   },
// );

// GET /weekly-lectures/next/student
export const getNextLectureForStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: user_id, role } = req.user as { id: number; role: string };

    if (role !== "STUDENT") throw new BadRequestError("User is not a student");

    const student = await prisma.student.findUnique({
      where: { userId: user_id },
      select: {
        student_id: true,
        section_id: true,
        major_id: true,
        group_id: true,
      },
    });
    if (!student) throw new NotFoundError("Student");

    const whereClause = student.section_id
      ? { lecture: { section_id: student.section_id } }
      : { lecture: { major_id: student.major_id } };

    const result = await findNextWeeklyLecture(whereClause);
    if (!result) {
      return res.status(200).json({ success: true, data: null });
    }

    const { weeklyLecture, isOngoing } = result;

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

    return res.status(200).json({
      success: true,
      data: {
        ...weeklyLecture,
        is_ongoing: isOngoing,
        has_attended,
      },
    });
  },
);

// GET /weekly-lectures/next/teacher
export const getNextLectureForTeacher = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: teacher_id, role } = req.user as { id: number; role: string };

    if (role !== "TEACHER") throw new BadRequestError("User is not a teacher");

    const result = await findNextWeeklyLecture({
      lecture: { instructor_id: teacher_id },
    });

    if (!result) return res.status(200).json({ success: true, data: null });

    return res.status(200).json({
      success: true,
      data: {
        ...result.weeklyLecture,
        is_ongoing: result.isOngoing,
      },
    });
  },
);

// GET /weekly-lectures/next/doctor
export const getNextLectureForDoctor = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: doctor_id, role } = req.user as { id: number; role: string };

    if (role !== "DOCTOR") throw new BadRequestError("User is not a doctor");

    const result = await findNextWeeklyLecture({
      lecture: { instructor_id: doctor_id },
    });

    if (!result) return res.status(200).json({ success: true, data: null });

    return res.status(200).json({
      success: true,
      data: {
        ...result.weeklyLecture,
        is_ongoing: result.isOngoing,
      },
    });
  },
);

// POST /weekly-lectures/:id/publish
export const publishWeeklyLecture = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid weekly lecture ID");

    const wl = await prisma.weeklyLecture.findUnique({
      where: { id },
      include: { lecture: true },
    });
    if (!wl) throw new NotFoundError("Weekly lecture");

    if (wl.status === "CANCELLED") {
      throw new BadRequestError("Cannot publish a cancelled lecture");
    }

    if (wl.lecture.lecture_type !== "PRACTICAL") {
      throw new BadRequestError(
        "Only practical lectures can be published for attendance",
      );
    }

    // Validate within time window
    const now = new Date();
    const { slotStart, slotEnd } = await computeSlotWindow(
      wl.lecture_date,
      wl.lecture.time_box_order,
    );

    if (now < slotStart || now > slotEnd) {
      throw new BadRequestError(
        `QR can only be generated during the lecture window (${slotStart.toISOString()} – ${slotEnd.toISOString()})`,
      );
    }

    const qr_string = uuidv4();

    const updated = await prisma.weeklyLecture.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        qr_string,
        published_at: now,
      },
      include: { lecture: { include: lectureInclude } },
    });

    return res.status(200).json({
      success: true,
      message: "Weekly lecture published and QR generated.",
      data: updated,
    });
  },
);

// POST /weekly-lectures/:id/toggle-cancel
export const toggleCancelWeeklyLecture = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid weekly lecture ID");

    const wl = await prisma.weeklyLecture.findUnique({ where: { id } });
    if (!wl) throw new NotFoundError("Weekly lecture");

    if (wl.status === "PUBLISHED") {
      throw new BadRequestError(
        "Cannot cancel a published lecture. Unpublish it first if needed.",
      );
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
      data: updated,
    });
  },
);
