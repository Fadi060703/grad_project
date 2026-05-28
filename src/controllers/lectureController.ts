// controllers/lectures.ts

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ForbiddenError } from "../errors";
import { createLectureSchema, updateLectureSchema } from "../validators/lecture";
import { Role, LectureType } from "../generated/prisma/client";

const lectureInclude = {
  course: { select: { id: true, name: true, course_type: true } },
  location: { select: { id: true, name: true } },
  instructor: { select: { id: true, full_name: true, role: true } },
  group: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  major: { select: { id: true, name: true } },
};

// GET /lectures?section_id=x  or  ?major_id=x
export const getLecturesSchedule = asyncHandler(async (req: Request, res: Response) => {
  const section_id = req.query.section_id ? parseInt(req.query.section_id as string, 10) : undefined;
  const major_id = req.query.major_id ? parseInt(req.query.major_id as string, 10) : undefined;

  if (!section_id && !major_id) {
    throw new BadRequestError("Either section_id or major_id query param is required");
  }

  if (section_id && major_id) {
    throw new BadRequestError("Cannot filter by both section_id and major_id");
  }

  const lectures = await prisma.lecture.findMany({
    where: {
      ...(section_id ? { section_id } : { major_id }),
    },
    include: lectureInclude,
    orderBy: [{ day: "asc" }, { time_box_order: "asc" }],
  });

  return res.status(200).json({ success: true, data: lectures });
});

export const createLecture = asyncHandler(async (req: Request, res: Response) => {
  const data = createLectureSchema.parse(req.body);

  // Validate instructor role
  const instructor = await prisma.user.findUnique({
    where: { id: data.instructor_id },
    select: { id: true, role: true, is_active: true },
  });

  if (!instructor) {
    throw new NotFoundError("Instructor");
  }

  if (instructor.role !== Role.DOCTOR && instructor.role !== Role.TEACHER) {
    throw new BadRequestError("Instructor must be a DOCTOR or TEACHER");
  }

  if (!instructor.is_active) {
    throw new BadRequestError("Instructor is not active");
  }

  // Validate section or major exists
  if (data.section_id) {
    const section = await prisma.section.findUnique({ where: { id: data.section_id } });
    if (!section) throw new NotFoundError("Section");
  }

  if (data.major_id) {
    const major = await prisma.major.findUnique({ where: { id: data.major_id } });
    if (!major) throw new NotFoundError("Major");
  }

  // Validate group belongs to the same section or major
  if (data.group_id) {
    const group = await prisma.group.findUnique({ where: { id: data.group_id } });
    if (!group) throw new NotFoundError("Group");

    if (data.section_id && group.section_id !== data.section_id) {
      throw new BadRequestError("Group does not belong to the provided section");
    }

    if (data.major_id && group.major_id !== data.major_id) {
      throw new BadRequestError("Group does not belong to the provided major");
    }
  }

  // Cell conflict logic
  const existingLecturesInCell = await prisma.lecture.findMany({
    where: {
      day: data.day,
      time_box_order: data.time_box_order,
      ...(data.section_id ? { section_id: data.section_id } : { major_id: data.major_id }),
    },
  });

  if (existingLecturesInCell.length > 0) {
    const hasTheoretical = existingLecturesInCell.some(
      (l) => l.lecture_type === LectureType.THEORETICAL
    );

    // Cell already has a theoretical — nothing can be added
    if (hasTheoretical) {
      throw new BadRequestError(
        "This time slot already has a theoretical lecture and cannot accept more lectures"
      );
    }

    // Cell has practicals — new lecture must also be practical
    if (data.lecture_type === LectureType.THEORETICAL) {
      throw new BadRequestError(
        "This time slot already has practical lectures and cannot accept a theoretical lecture"
      );
    }

    // Cell has practicals and new one is practical — check group uniqueness
    if (data.group_id) {
      const groupAlreadyInCell = existingLecturesInCell.some(
        (l) => l.group_id === data.group_id
      );
      if (groupAlreadyInCell) {
        throw new BadRequestError("This group already has a lecture in this time slot");
      }
    }
  }

  const lecture = await prisma.lecture.create({
    data: {
      day: data.day,
      time_box_order: data.time_box_order,
      lecture_type: data.lecture_type,
      course_id: data.course_id,
      location_id: data.location_id,
      instructor_id: data.instructor_id,
      section_id: data.section_id ?? null,
      major_id: data.major_id ?? null,
      group_id: data.group_id ?? null,
    },
    include: lectureInclude,
  });

  return res.status(201).json({
    success: true,
    message: "Lecture created successfully",
    data: lecture,
  });
});

export const updateLecture = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) throw new BadRequestError("Invalid lecture ID");

  const data = updateLectureSchema.parse(req.body);

  const existing = await prisma.lecture.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Lecture");

  if (data.instructor_id) {
    const instructor = await prisma.user.findUnique({
      where: { id: data.instructor_id },
      select: { id: true, role: true, is_active: true },
    });

    if (!instructor) throw new NotFoundError("Instructor");

    if (instructor.role !== Role.DOCTOR && instructor.role !== Role.TEACHER) {
      throw new BadRequestError("Instructor must be a DOCTOR or TEACHER");
    }

    if (!instructor.is_active) {
      throw new BadRequestError("Instructor is not active");
    }
  }

  if (data.group_id) {
    const group = await prisma.group.findUnique({ where: { id: data.group_id } });
    if (!group) throw new NotFoundError("Group");

    if (existing.section_id && group.section_id !== existing.section_id) {
      throw new BadRequestError("Group does not belong to the provided section");
    }

    if (existing.major_id && group.major_id !== existing.major_id) {
      throw new BadRequestError("Group does not belong to the provided major");
    }
  }

  const updated = await prisma.lecture.update({
    where: { id },
    data: {
      ...(data.location_id !== undefined && { location_id: data.location_id }),
      ...(data.instructor_id !== undefined && { instructor_id: data.instructor_id }),
      ...(data.group_id !== undefined && { group_id: data.group_id }),
    },
    include: lectureInclude,
  });

  return res.status(200).json({
    success: true,
    message: "Lecture updated successfully",
    data: updated,
  });
});

export const deleteLecture = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) throw new BadRequestError("Invalid lecture ID");

  const existing = await prisma.lecture.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Lecture");

  await prisma.lecture.delete({ where: { id } });

  return res.status(200).json({
    success: true,
    message: "Lecture deleted successfully",
  });
});