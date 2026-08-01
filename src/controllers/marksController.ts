import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { paginationSchema } from "../lib/express-prisma-query/pagination-schemas";
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

const MARKS_PUBLISH_ROLES = new Set(["ADMIN", "MARKS_DE", "EXAMS_DE"]);

const markCourseSelect = {
  id: true,
  name: true,
  course_type: true,
  exam_type: true,
  code: true,
  theoretical_grade: true,
  practical_grade: true,
  is_practical_marks_published: true,
  is_marks_published: true,
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

  const value = search.trim();

  return {
    OR: [
      {
        course: {
          name: {
            contains: value,
            mode: "insensitive" as const,
          },
        },
      },
      {
        course: {
          code: {
            contains: value,
            mode: "insensitive" as const,
          },
        },
      },
    ],
  };
};

const getCurrentAcademicKey = async () => {
  const settings = await prisma.systemSettings.findFirst({
    select: { current_academic_key: true },
  });

  return settings?.current_academic_key ?? "";
};

const parseJsonArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseCourseId = (raw: string | undefined) => {
  const courseId = Number(raw);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new BadRequestError("Invalid course ID");
  }
  return courseId;
};

const assertCanPublishMarks = (req: Request) => {
  const { id, role } = req.user as { id: number | string; role: string };
  const userId = Number(id);

  if (!MARKS_PUBLISH_ROLES.has(role) || !Number.isInteger(userId) || userId <= 0) {
    throw new ForbiddenError("You are not allowed to publish marks");
  }

  return userId;
};

const assertCourseMarksComplete = async (courseId: number, academicKey: string) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      is_practical_marks_published: true,
      is_marks_published: true,
      students: { select: { student_id: true } },
    },
  });

  if (!course) {
    throw new NotFoundError("Course");
  }

  const studentIds = course.students.map((student) => student.student_id);
  if (studentIds.length === 0) {
    return course;
  }

  const marks = await prisma.mark.findMany({
    where: {
      course_id: courseId,
      academic_key: academicKey,
      student_id: { in: studentIds },
    },
    select: { student_id: true },
  });

  const markedStudentIds = new Set(marks.map((mark) => mark.student_id));
  const missingStudentIds = studentIds.filter((studentId) => !markedStudentIds.has(studentId));

  if (missingStudentIds.length > 0) {
    throw new BadRequestError(
      `Cannot publish marks before marks exist for all course students. Missing student IDs: [${missingStudentIds.join(", ")}]`,
    );
  }

  return course;
};

export const getAllMarks = createListHandler({
  prisma: prisma.mark,

  allowedSortFields: [
    "id",
    "course_id",
    "student_id",
    "academic_key",
    "practical_grade",
    "theoretical_grade",
    "created_at",
    "updated_at",
  ],

  fieldTypes: {
    id: "number",
    course_id: "number",
    student_id: "number",
    academic_key: "text",
    practical_grade: "number",
    theoretical_grade: "number",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: [],

  querySchema: z.object({
    academic_key: z.string().optional(),
  }),

  findManyArgs: {
    select: {
      id: true,
      course_id: true,
      course: { select: markCourseSelect },
      student_id: true,
      student: { select: markStudentSelect },
      academic_key: true,
      practical_grade: true,
      theoretical_grade: true,
      created_at: true,
      updated_at: true,
    },
  } as any,

  handleFindArgs: async ({ query, findManyArgs }) => {
    const searchWhere = buildCourseSearchWhere(query.search);
    const academicKey = query.academic_key !== undefined
      ? query.academic_key
      : await getCurrentAcademicKey();

    const andConditions = [
      findManyArgs.where,
      { academic_key: academicKey },
    ];

    if (searchWhere) {
      andConditions.push(searchWhere);
    }

    return {
      where: {
        AND: andConditions,
      },
    };
  },

  mapResult: ({ data }) => z.array(getMarksSchema).parse(data.map(mapMark)),
});

export const getMyStudentMarks = asyncHandler(async (req: Request, res: Response) => {
  const query = paginationSchema.parse(req.query);
  const { id: user_id, role } = req.user as { id: number | string; role: string };

  if (role !== "STUDENT") {
    throw new ForbiddenError("Only students can access student marks");
  }

  const student = await prisma.student.findUnique({
    where: { userId: Number(user_id) },
    select: { student_id: true },
  });

  if (!student) {
    throw new ForbiddenError("Student profile not found");
  }

  const searchWhere = buildCourseSearchWhere(query.search);
  const where: any = {
    AND: [
      { student_id: student.student_id },
      ...(searchWhere ? [searchWhere] : []),
    ],
  };

  const marks = await prisma.mark.findMany({
    where,
    select: {
      id: true,
      course_id: true,
      course: { select: markCourseSelect },
      academic_key: true,
      practical_grade: true,
      theoretical_grade: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (marks.length === 0) {
    return res.json({
      data: [],
      meta: {
        total: 0,
        page: Number(query.page),
        pageSize: Number(query.pagesize),
        totalPages: 0,
      },
    });
  }

  const publicationFilters = marks.map((mark) => ({
    course_id: mark.course_id,
    academic_key: mark.academic_key,
  }));

  const publications = await prisma.courseMarksPublication.findMany({
    where: { OR: publicationFilters },
    select: {
      course_id: true,
      academic_key: true,
      publish_type: true,
      published_at: true,
    },
  });

  const publicationByKey = new Map(
    publications.map((publication) => [
      `${publication.course_id}:${publication.academic_key}`,
      publication,
    ]),
  );

  const latestByCourse = new Map<number, { mark: (typeof marks)[number]; publication: (typeof publications)[number] }>();

  for (const mark of marks) {
    const publication = publicationByKey.get(`${mark.course_id}:${mark.academic_key}`);
    if (!publication) continue;

    const current = latestByCourse.get(mark.course_id);
    if (!current || publication.published_at > current.publication.published_at) {
      latestByCourse.set(mark.course_id, { mark, publication });
    }
  }

  const rows = [...latestByCourse.values()].map(({ mark, publication }) => {
    if (publication.publish_type === "PRACTICAL") {
      return mapMark({
        ...mark,
        theoretical_grade: 0,
      });
    }

    return mapMark(mark);
  });

  const sortItems = parseJsonArray(query.sort);
  const firstSort = sortItems[0] as { id?: string; desc?: boolean } | undefined;
  const allowedSortFields = new Set([
    "id",
    "course_id",
    "academic_key",
    "practical_grade",
    "theoretical_grade",
    "created_at",
    "updated_at",
  ]);

  if (firstSort?.id && allowedSortFields.has(firstSort.id)) {
    rows.sort((a: any, b: any) => {
      const aValue = a[firstSort.id as string];
      const bValue = b[firstSort.id as string];
      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return firstSort.desc ? 1 : -1;
      if (bValue === null || bValue === undefined) return firstSort.desc ? -1 : 1;
      return aValue > bValue === Boolean(firstSort.desc) ? -1 : 1;
    });
  } else {
    rows.sort((a: any, b: any) => {
      const aPublication = publicationByKey.get(`${a.course_id}:${a.academic_key}`);
      const bPublication = publicationByKey.get(`${b.course_id}:${b.academic_key}`);
      return Number(bPublication?.published_at ?? 0) - Number(aPublication?.published_at ?? 0);
    });
  }

  const total = rows.length;
  const page = Number(query.page);
  const pageSize = Number(query.pagesize);
  const paginated = rows.slice((page - 1) * pageSize, page * pageSize);

  return res.json({
    data: z.array(getMyStudentMarksSchema).parse(paginated),
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

export const bulkCreateMarks = asyncHandler(
  async (req: Request, res: Response) => {
    const data = bulkCreateMarksSchema.parse(req.body);
    const academicKey = await getCurrentAcademicKey();
    const marks = data.marks.map((mark) => ({
      ...mark,
      academic_key: academicKey,
    }));

    const pairKeys = new Set<string>();
    for (const mark of marks) {
      const key = `${mark.course_id}:${mark.student_id}:${mark.academic_key}`;
      if (pairKeys.has(key)) {
        throw new BadRequestError(
          "Duplicate marks for the same student, course, and academic key",
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

    await prisma.$transaction(
      marks.map((mark) =>
        prisma.mark.upsert({
          where: {
            course_id_student_id_academic_key: {
              course_id: mark.course_id,
              student_id: mark.student_id,
              academic_key: mark.academic_key,
            },
          },
          create: mark,
          update: {
            practical_grade: mark.practical_grade,
            theoretical_grade: mark.theoretical_grade,
          },
        }),
      ),
    );

    return res.status(200).json({
      count: marks.length,
      message: "Marks upserted successfully",
    });
  },
);

export const publishPracticalMarks = asyncHandler(async (req: Request, res: Response) => {
  const publishedBy = assertCanPublishMarks(req);
  const courseId = parseCourseId(req.params.courseId as string | undefined);
  const academicKey = await getCurrentAcademicKey();

  await assertCourseMarksComplete(courseId, academicKey);

  const existingPublication = await prisma.courseMarksPublication.findUnique({
    where: {
      course_id_academic_key: {
        course_id: courseId,
        academic_key: academicKey,
      },
    },
    select: { publish_type: true },
  });

  if (existingPublication?.publish_type === "PRACTICAL") {
    throw new ConflictError("Practical marks are already published for this course and academic key");
  }

  if (existingPublication?.publish_type === "FULL") {
    throw new ConflictError("Full marks are already published for this course and academic key");
  }

  const publishedAt = new Date();
  const [publication, course] = await prisma.$transaction([
    prisma.courseMarksPublication.create({
      data: {
        course_id: courseId,
        academic_key: academicKey,
        publish_type: "PRACTICAL",
        published_by: publishedBy,
        published_at: publishedAt,
      },
    }),
    prisma.course.update({
      where: { id: courseId },
      data: { is_practical_marks_published: true },
      select: {
        id: true,
        is_practical_marks_published: true,
        is_marks_published: true,
      },
    }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Practical marks published successfully",
    data: {
      course,
      publication,
    },
  });
});

export const publishFullMarks = asyncHandler(async (req: Request, res: Response) => {
  const publishedBy = assertCanPublishMarks(req);
  const courseId = parseCourseId(req.params.courseId as string | undefined);
  const academicKey = await getCurrentAcademicKey();

  await assertCourseMarksComplete(courseId, academicKey);

  const existingPublication = await prisma.courseMarksPublication.findUnique({
    where: {
      course_id_academic_key: {
        course_id: courseId,
        academic_key: academicKey,
      },
    },
    select: { id: true, publish_type: true },
  });

  if (existingPublication?.publish_type === "FULL") {
    throw new ConflictError("Full marks are already published for this course and academic key");
  }

  const publishedAt = new Date();
  const publicationWrite = existingPublication
    ? prisma.courseMarksPublication.update({
        where: { id: existingPublication.id },
        data: {
          publish_type: "FULL" as const,
          published_by: publishedBy,
          published_at: publishedAt,
        },
      })
    : prisma.courseMarksPublication.create({
        data: {
          course_id: courseId,
          academic_key: academicKey,
          publish_type: "FULL",
          published_by: publishedBy,
          published_at: publishedAt,
        },
      });

  const [publication, course] = await prisma.$transaction([
    publicationWrite,
    prisma.course.update({
      where: { id: courseId },
      data: {
        is_practical_marks_published: true,
        is_marks_published: true,
      },
      select: {
        id: true,
        is_practical_marks_published: true,
        is_marks_published: true,
      },
    }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Full marks published successfully",
    data: {
      course,
      publication,
    },
  });
});

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
      academic_key: existing.academic_key,
      NOT: { id },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictError(
      "Mark already exists for this student, course, and academic key",
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
      academic_key: true,
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
