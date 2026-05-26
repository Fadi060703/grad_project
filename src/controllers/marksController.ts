import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";
import {
  bulkCreateMarksSchema,
  bulkDeleteMarksSchema,
  getMarksSchema,
  updateMarkSchema,
} from "../validators/marks";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ConflictError, NotFoundError } from "../errors";

export const getAllMarks = createListHandler({
  prisma: prisma.mark,

  allowedSortFields: [
    "id",
    "marks_course_id",
    "student_id",
    "practical_grade",
    "theoretical_grade",
    "created_at",
    "updated_at",
  ],

  fieldTypes: {
    id: "number",
    marks_course_id: "number",
    student_id: "number",
    practical_grade: "number",
    theoretical_grade: "number",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: [],

  findManyArgs: {
    select: {
      id: true,
      marks_course_id: true,
      marks_course: {
        select: {
          name: true,
        },
      },
      student_id: true,
      student: {
        select: {
          student_id: true,
          mother_name: true,
          year: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              full_name: true,
              email: true,
            },
          },
        },
      },
      practical_grade: true,
      theoretical_grade: true,
      created_at: true,
      updated_at: true,
    },
  } as any,

  mapResult: ({ data }) => z.array(getMarksSchema).parse(data),
});

export const bulkCreateMarks = asyncHandler(
  async (req: Request, res: Response) => {
    const data = bulkCreateMarksSchema.parse(req.body);
    const marks = data.marks;

    const pairKeys = new Set<string>();
    for (const mark of marks) {
      const key = `${mark.marks_course_id}:${mark.student_id}`;
      if (pairKeys.has(key)) {
        throw new BadRequestError(
          "Duplicate marks for the same student and marks course",
        );
      }
      pairKeys.add(key);
    }

    const marksCourseIds = [...new Set(marks.map((m) => m.marks_course_id))];
    const studentIds = [...new Set(marks.map((m) => m.student_id))];

    const [marksCourses, students] = await Promise.all([
      prisma.marksCourse.findMany({
        where: { id: { in: marksCourseIds } },
        select: { id: true },
      }),
      prisma.student.findMany({
        where: { student_id: { in: studentIds } },
        select: { student_id: true },
      }),
    ]);

    if (marksCourses.length !== marksCourseIds.length) {
      throw new NotFoundError("Marks course");
    }

    if (students.length !== studentIds.length) {
      throw new NotFoundError("Student");
    }

    const existing = await prisma.mark.findMany({
      where: {
        OR: marks.map((item) => ({
          marks_course_id: item.marks_course_id,
          student_id: item.student_id,
        })),
      },
      select: { marks_course_id: true, student_id: true },
    });

    if (existing.length > 0) {
      throw new ConflictError(
        "One or more marks already exist for this student and marks course",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return tx.mark.createMany({ data: marks });
    });

    return res.status(201).json({
      count: result.count,
      message: "Marks created successfully",
    });
  },
);

export const updateMark = asyncHandler(async (req: Request, res: Response) => {
  //@ts-expect-error
  const id = parseInt(req.params.id, 10);
  const data = updateMarkSchema.parse(req.body);

  const existing = await prisma.mark.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Mark");
  }

  if (data.marks_course_id) {
    const marksCourse = await prisma.marksCourse.findUnique({
      where: { id: data.marks_course_id },
      select: { id: true },
    });

    if (!marksCourse) {
      throw new NotFoundError("Marks course");
    }
  }

  if (data.student_id) {
    const student = await prisma.student.findUnique({
      where: { student_id: data.student_id },
      select: { student_id: true },
    });

    if (!student) {
      throw new NotFoundError("Student");
    }
  }

  const practical =
    data.practical_grade !== undefined
      ? data.practical_grade
      : existing.practical_grade;
  const theoretical =
    data.theoretical_grade !== undefined
      ? data.theoretical_grade
      : existing.theoretical_grade;

  const marksCourseId =
    data.marks_course_id !== undefined
      ? data.marks_course_id
      : existing.marks_course_id;
  const studentId =
    data.student_id !== undefined ? data.student_id : existing.student_id;

  const duplicate = await prisma.mark.findFirst({
    where: {
      marks_course_id: marksCourseId,
      student_id: studentId,
      NOT: { id },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictError(
      "Mark already exists for this student and marks course",
    );
  }

  if (practical + theoretical > 100) {
    throw new BadRequestError(
      "Sum of practical and theoretical grades must be <= 100",
    );
  }

  const updated = await prisma.mark.update({
    where: { id },
    data: {
      marks_course_id: data.marks_course_id,
      student_id: data.student_id,
      practical_grade: data.practical_grade,
      theoretical_grade: data.theoretical_grade,
    },
    select: {
      id: true,
      marks_course_id: true,
      student_id: true,
      practical_grade: true,
      theoretical_grade: true,
      created_at: true,
      updated_at: true,
    },
  });

  return res.status(200).json(updated);
});

export const bulkDeleteMarks = asyncHandler(
  async (req: Request, res: Response) => {
    const data = bulkDeleteMarksSchema.parse(req.body);

    const existing = await prisma.mark.findMany({
      where: { id: { in: data.ids } },
      select: { id: true },
    });

    if (existing.length !== data.ids.length) {
      throw new NotFoundError("Mark");
    }

    const result = await prisma.$transaction(async (tx) => {
      return tx.mark.deleteMany({
        where: { id: { in: data.ids } },
      });
    });

    return res.status(200).json({
      count: result.count,
      message: "Marks deleted successfully",
    });
  },
);
