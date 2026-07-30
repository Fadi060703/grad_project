import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors";
import { markAttendanceSchema } from "../validators/attendance";

async function computeSlotWindow(lectureDate: Date, timeBoxOrder: number) {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings?.lectures_start_time || !settings?.lecture_duration) {
    throw new BadRequestError(
      "System settings are missing lecture timing configuration",
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

  const slotStart = new Date(lectureDate);
  slotStart.setHours(
    startHour,
    startMin + (timeBoxOrder - 1) * settings.lecture_duration,
    0,
    0,
  );

  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + settings.lecture_duration);

  return { slotStart, slotEnd };
}

export const markAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: userId, role } = req.user as { id: number | string; role: string };
    if (role !== "STUDENT") {
      throw new ForbiddenError("Only students can mark attendance");
    }

    const data = markAttendanceSchema.parse(req.body);

    const student = await prisma.student.findUnique({
      where: { userId: Number(userId) },
      select: {
        student_id: true,
        group_id: true,
      },
    });
    if (!student) throw new NotFoundError("Student");

    const wl = await prisma.weeklyLecture.findUnique({
      where: { id: data.weekly_lecture_id },
      include: {
        lecture: true,
      },
    });
    if (!wl) throw new NotFoundError("Weekly lecture");

    if (wl.lecture.lecture_type !== "PRACTICAL") {
      throw new BadRequestError("Attendance can only be marked for practical lectures");
    }

    if (wl.status !== "PUBLISHED") {
      throw new BadRequestError("This lecture is not accepting attendance right now");
    }

    if (!wl.qr_string || wl.qr_string !== data.qr_string) {
      throw new BadRequestError("Invalid QR code");
    }

    const { slotStart, slotEnd } = await computeSlotWindow(
      wl.lecture_date,
      wl.lecture.time_box_order,
    );

    const now = new Date();
    if (now < slotStart || now > slotEnd) {
      throw new BadRequestError(
        `QR code is only valid during the lecture window (${slotStart.toISOString()} – ${slotEnd.toISOString()})`,
      );
    }

    if (!wl.lecture.group_id || wl.lecture.group_id !== student.group_id) {
      throw new BadRequestError("Student does not belong to this lecture's group");
    }

    const attendance = await prisma.lectureAttendance.findUnique({
      where: {
        weekly_lecture_id_student_id: {
          weekly_lecture_id: wl.id,
          student_id: student.student_id,
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

    const updated = await prisma.lectureAttendance.update({
      where: {
        weekly_lecture_id_student_id: {
          weekly_lecture_id: wl.id,
          student_id: student.student_id,
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
