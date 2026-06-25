import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";
import {
  createExamSchema,
  updateExamSchema,
  examResponseSchema,
  bulkAddStudentsSchema,
} from "../validators/exams";
import { z } from "zod";
import { createListHandler } from "../lib/express-prisma-query";

// ─── Shared select shape ──────────────────────────────────────────────────────

const examSelect = {
  id: true,
  type: true,
  course_id: true,
  course: {
    select: {
      id: true,
      name: true,
    },
  },
  settings: {
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
      created_at: true,
      updated_at: true,
    },
  },
  created_at: true,
  updated_at: true,
} as const;

// ─── GET /exams ───────────────────────────────────────────────────────────────

// export const getAllExams = asyncHandler(async (req: Request, res: Response) => {
//   const exams = await prisma.exam.findMany({
//     select: examSelect,
//     orderBy: { created_at: "desc" },
//   });

//   const parsed = z.array(examResponseSchema).parse(exams);

//   return res.status(200).json({
//     success: true,
//     data: parsed,
//   });
// });

export const getAllExams = createListHandler({
  prisma: prisma.exam,
  allowedSortFields: ["id", "created_at"],
  fieldTypes: {
    id: "number",
    course_id: "number",
    type: "text",
  },
  searchableFields: [],
  findManyArgs: {
    select: examSelect,
  } as any,
  mapResult: ({ data }) => z.array(examResponseSchema).parse(data),
});

// ─── GET /exams/:id ───────────────────────────────────────────────────────────

export const getExamById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string , 10);

  if (isNaN(id)) {
    throw new BadRequestError("Invalid exam ID");
  }

  const exam = await prisma.exam.findUnique({
    where: { id },
    select: examSelect,
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  const parsed = examResponseSchema.parse(exam);

  return res.status(200).json({
    success: true,
    data: parsed,
  });
});

// ─── POST /exams ──────────────────────────────────────────────────────────────

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  const data = createExamSchema.parse(req.body);

  // Check course exists
  const course = await prisma.course.findUnique({
    where: { id: data.course_id },
  });

  if (!course) {
    throw new NotFoundError("Course");
  }

  // Enforce max one exam per type per course
  const existing = await prisma.exam.findUnique({
    where: {
      course_id_type: {
        course_id: data.course_id,
        type: data.exam_type,
      },
    },
  });

  if (existing) {
    throw new ConflictError(
      `A ${data.exam_type.toLowerCase()} exam already exists for this course`
    );
  }

  // Validate all location_ids exist
  const locationIds = data.settings.map((s) => s.location_id);
  const locations = await prisma.universityLocation.findMany({
    where: { id: { in: locationIds } },
    select: { id: true },
  });

  if (locations.length !== locationIds.length) {
    throw new NotFoundError("One or more locations");
  }

  // Create exam + settings in one transaction
  const created = await prisma.exam.create({
    data: {
      course_id: data.course_id,
      type: data.exam_type,
      settings: {
        create: data.settings.map((s) => ({
          location_id: s.location_id,
          date: new Date(s.date),
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      },
    },
    select: examSelect,
  });

  const parsed = examResponseSchema.parse(created);

  return res.status(201).json({
    success: true,
    message: "Exam created successfully",
    data: parsed,
  });
});

// ─── PATCH /exams/:id ─────────────────────────────────────────────────────────

export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    throw new BadRequestError("Invalid exam ID");
  }

  const data = updateExamSchema.parse(req.body);

  // Check exam exists
  const existingExam = await prisma.exam.findUnique({
    where: { id },
  });

  if (!existingExam) {
    throw new NotFoundError("Exam");
  }

  // If changing course or type, check uniqueness constraint
  if (data.course_id !== undefined || data.exam_type !== undefined) {
    const checkCourseId = data.course_id ?? existingExam.course_id;
    const checkType = data.exam_type ?? existingExam.type;

    if (data.course_id !== undefined) {
      const courseExists = await prisma.course.findUnique({
        where: { id: data.course_id },
      });
      if (!courseExists) throw new NotFoundError("Course");
    }

    const duplicate = await prisma.exam.findUnique({
      where: {
        course_id_type: {
          course_id: checkCourseId,
          type: checkType,
        },
      },
    });

    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(
        `A ${checkType.toLowerCase()} exam already exists for this course`
      );
    }
  }

  // If settings are provided, validate locations then replace all settings
  if (data.settings !== undefined) {
    const locationIds = data.settings.map((s) => s.location_id);
    const locations = await prisma.universityLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true },
    });

    if (locations.length !== locationIds.length) {
      throw new NotFoundError("One or more locations");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Replace settings if provided (delete all + recreate)
    if (data.settings !== undefined) {
      await tx.examSettings.deleteMany({ where: { exam_id: id } });
    }

    return tx.exam.update({
      where: { id },
      data: {
        ...(data.course_id !== undefined && { course_id: data.course_id }),
        ...(data.exam_type !== undefined && { type: data.exam_type }),
        ...(data.settings !== undefined && {
          settings: {
            create: data.settings.map((s) => ({
              location_id: s.location_id,
              date: new Date(s.date),
              start_time: s.start_time,
              end_time: s.end_time,
            })),
          },
        }),
      },
      select: examSelect,
    });
  });

  const parsed = examResponseSchema.parse(updated);

  return res.status(200).json({
    success: true,
    message: "Exam updated successfully",
    data: parsed,
  });
});

// ─── DELETE /exams/:id ────────────────────────────────────────────────────────

export const deleteExam = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string , 10);

  if (isNaN(id)) {
    throw new BadRequestError("Invalid exam ID");
  }

  const existingExam = await prisma.exam.findUnique({
    where: { id },
    include: { settings: true },
  });

  if (!existingExam) {
    throw new NotFoundError("Exam");
  }

  const deleted = await prisma.exam.delete({
    where: { id },
    select: {
      id: true,
      type: true,
      course_id: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Exam deleted successfully",
    data: deleted,
  });
});


// ─── POST /exam-settings/:id/students ────────────────────────────────────────

export const bulkAddStudentsToExamSetting = asyncHandler(async (req: Request, res: Response) => {
  const examSettingId = parseInt(req.params.id as string, 10);

  if (isNaN(examSettingId)) {
    throw new BadRequestError("Invalid exam setting ID");
  }

  const { student_ids } = bulkAddStudentsSchema.parse(req.body);

  // Validate exam setting exists
  const examSetting = await prisma.examSettings.findUnique({
    where: { id: examSettingId },
  });

  if (!examSetting) {
    throw new NotFoundError("Exam setting");
  }

  // Validate all students exist
  const students = await prisma.student.findMany({
    where: { student_id: { in: student_ids } },
    select: { student_id: true },
  });

  if (students.length !== student_ids.length) {
    throw new NotFoundError("One or more students");
  }

  // Connect students (skip already connected ones)
  const result = await prisma.examSettings.update({
    where: { id: examSettingId },
    data: {
      students: {
        connect: student_ids.map((id) => ({ student_id: id })),
      },
    },
  });

  return res.status(200).json({
    success: true,
    count: student_ids.length,
    message: "Students added successfully",
  });
});