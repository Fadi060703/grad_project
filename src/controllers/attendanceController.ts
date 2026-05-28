// controllers/attendance.ts

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError } from "../errors";
import { markAttendanceSchema } from "../validators/attendance";

export const markAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    // TODO: replace data.student_id with req.user.id from auth token
    const data = markAttendanceSchema.parse(req.body);

    // 1. Find the WeeklyLecture
    const wl = await prisma.weeklyLecture.findUnique({
      where: { id: data.weekly_lecture_id },
      include: {
        lecture: true,
      },
    });

    if (!wl) throw new NotFoundError("Weekly lecture");

    // 2. Must be published
    if (wl.status !== "PUBLISHED") {
      throw new BadRequestError(
        "This lecture is not accepting attendance right now",
      );
    }

    // 3. Validate qr_string matches
    if (wl.qr_string !== data.qr_string) {
      throw new BadRequestError("Invalid QR code");
    }

    // 4. Validate within time window
    const settings = await prisma.systemSettings.findFirst();
    if (!settings?.lectures_start_time || !settings?.lecture_duration) {
      throw new BadRequestError(
        "System settings are missing lecture timing configuration",
      );
    }

    const [startHour, startMin] = settings.lectures_start_time
      .split(":")
      .map(Number);
    const duration = settings.lecture_duration;
    const order = wl.lecture.time_box_order;

    const slotStart = new Date(wl.lecture_date);
    slotStart.setHours(startHour, startMin + (order - 1) * duration, 0, 0);

    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + duration);

    const now = new Date();
    if (now < slotStart || now > slotEnd) {
      throw new BadRequestError(
        `QR code is only valid during the lecture window (${slotStart.toISOString()} – ${slotEnd.toISOString()})`,
      );
    }

    // 5. Only practical lectures accept attendance
    if (wl.lecture.lecture_type !== "PRACTICAL") {
      throw new BadRequestError(
        "Attendance can only be marked for practical lectures",
      );
    }

    // 6. Validate student exists
    const student = await prisma.student.findUnique({
      where: { student_id: data.student_id },
      select: {
        student_id: true,
        group_id: true,
        section_id: true,
        major_id: true,
      },
    });
    if (!student) throw new NotFoundError("Student");

    // 7. Validate student belongs to the lecture's group
    if (wl.lecture.group_id !== student.group_id) {
      throw new BadRequestError(
        "Student does not belong to this lecture's group",
      );
    }

    // 8. Find the attendance record — no lazy init, must exist
    const attendance = await prisma.lectureAttendance.findUnique({
      where: {
        weekly_lecture_id_student_id: {
          weekly_lecture_id: wl.id,
          student_id: data.student_id,
        },
      },
    });

    if (!attendance) {
      throw new BadRequestError(
        "No attendance record found for this student in this lecture",
      );
    }

    if (attendance.has_attended) {
      throw new BadRequestError("Attendance already marked for this student");
    }

    // 9. Mark attended
    const updated = await prisma.lectureAttendance.update({
      where: {
        weekly_lecture_id_student_id: {
          weekly_lecture_id: wl.id,
          student_id: data.student_id,
        },
      },
      data: { has_attended: true },
    });

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: updated,
    });
  },
);
