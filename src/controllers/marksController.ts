import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";
import {
  bulkCreateMarksSchema,
  bulkDeleteMarksSchema,
  getMarksSchema,
  getMyStudentMarksSchema,
  updateMarkSchema,
} from "../validators/marks";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors";

const markCourseSelect = {
  id: true,
  name: true,
  course_type: true,
  exam_type: true,
  code: true,
  theoretical_grade: true,
  practical_grade: true,
  year: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const markStudentSelect = {
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
} as const;

const mapMark = (mark: any) => ({
  ...mark,
  total_grade: mark.practical_grade + mark.theoretical_grade,
});

const buildCourseSearchWhere = (search: unknown) => {
  if (typeof search !== "string" || !search.trim()) {
    return null;
  }

  return {
    course: {
      name: {
        contains: search.trim(),
        mode: "insensitive" as const,
      },
    },
  };
};

export const getAllMarks = createListHandler({
  prisma: prisma.mark,

  allowedSortFields: [
    "id",
    "course_id",
    "student_id",
    "practical_grade",
    "theoretical_grade",
    "created_at",
    "updated_at",
  ],

  fieldTypes: {
    id: "number",
    course_id: "number",
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
      course_id: true,
      course: { select: markCourseSelect },
      student_id: true,
      student: { select: markStudentSelect },
      practical_grade: true,
      theoretical_grade: true,
      created_at: true,
      updated_at: true,
    },
  } as any,

  handleFindArgs: ({ query, findManyArgs }) => {
    const searchWhere = buildCourseSearchWhere(query.search);
    if (!searchWhere) return {};

    return {
      where: {
        AND: [findManyArgs.where, searchWhere],
      },
    };
  },

  mapResult: ({ data }) => z.array(getMarksSchema).parse(data.map(mapMark)),
});

export const getMyStudentMarks = createListHandler({
  prisma: prisma.mark,

  allowedSortFields: [
    "id",
    "course_id",
    "practical_grade",
    "theoretical_grade",
    "created_at",
    "updated_at",
  ],

  fieldTypes: {
    id: "number",
    course_id: "number",
    practical_grade: "number",
    theoretical_grade: "number",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["course.name", "course.code"],

  findManyArgs: {
    select: {
      id: true,
      course_id: true,
      course: { select: markCourseSelect },
      practical_grade: true,
      theoretical_grade: true,
      created_at: true,
      updated_at: true,
    },
  } as any,

  handleFindArgs: async ({ req, query, findManyArgs }) => {
    const { id: user_id, role } = req.user as { id: number; role: string };

    if (role !== "STUDENT") {
      throw new ForbiddenError("Only students can access student marks");
    }

    const student = await prisma.student.findUnique({
      where: { userId: user_id },
      select: { student_id: true },
    });

    if (!student) {
      throw new ForbiddenError("Student profile not found");
    }

    const searchWhere = buildCourseSearchWhere(query.search);
    const andConditions = [
      findManyArgs.where,
      { student_id: student.student_id },
    ];

    if (searchWhere) {
      andConditions.push(searchWhere);
    }

    return {
      ...findManyArgs,
      where: {
        AND: andConditions,
      },
      orderBy: findManyArgs.orderBy ?? { created_at: "desc" },
    };
  },

  mapResult: ({ data }) =>
    z.array(getMyStudentMarksSchema).parse(data.map(mapMark)),
});

export const bulkCreateMarks = asyncHandler(
  async (req: Request, res: Response) => {
    const data = bulkCreateMarksSchema.parse(req.body);
    const marks = data.marks;

    const pairKeys = new Set<string>();
    for (const mark of marks) {
      const key = `${mark.course_id}:${mark.student_id}`;
      if (pairKeys.has(key)) {
        throw new BadRequestError(
          "Duplicate marks for the same student and course",
        );
      }
      pairKeys.add(key);
    }

    const courseIds = [...new Set(marks.map((m) => m.course_id))];
    const studentIds = [...new Set(marks.map((m) => m.student_id))];

    const [courses, students] = await Promise.all([
      prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true },
      }),
      prisma.student.findMany({
        where: { student_id: { in: studentIds } },
        select: { student_id: true },
      }),
    ]);

    if (courses.length !== courseIds.length) {
      throw new NotFoundError("Course");
    }

    if (students.length !== studentIds.length) {
      throw new NotFoundError("Student");
    }

    const existing = await prisma.mark.findMany({
      where: {
        OR: marks.map((item) => ({
          course_id: item.course_id,
          student_id: item.student_id,
        })),
      },
      select: { course_id: true, student_id: true },
    });

    if (existing.length > 0) {
      throw new ConflictError(
        "One or more marks already exist for this student and course",
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
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    throw new BadRequestError("Invalid mark ID");
  }

  const data = updateMarkSchema.parse(req.body);

  const existing = await prisma.mark.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Mark");
  }

  if (data.course_id) {
    const course = await prisma.course.findUnique({
      where: { id: data.course_id },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundError("Course");
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

  const courseId =
    data.course_id !== undefined ? data.course_id : existing.course_id;
  const studentId =
    data.student_id !== undefined ? data.student_id : existing.student_id;

  const duplicate = await prisma.mark.findFirst({
    where: {
      course_id: courseId,
      student_id: studentId,
      NOT: { id },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictError(
      "Mark already exists for this student and course",
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
      course_id: data.course_id,
      student_id: data.student_id,
      practical_grade: data.practical_grade,
      theoretical_grade: data.theoretical_grade,
    },
    select: {
      id: true,
      course_id: true,
      course: { select: markCourseSelect },
      student_id: true,
      student: { select: markStudentSelect },
      practical_grade: true,
      theoretical_grade: true,
      created_at: true,
      updated_at: true,
    },
  });

  return res.status(200).json(getMarksSchema.parse(mapMark(updated)));
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
