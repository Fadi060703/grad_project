import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";
import {
  createExamSchema,
  updateExamSchema,
  examResponseSchema,
  bulkAddStudentsSchema,
  examSettingResponseSchema,
  examIdParamsSchema,
} from "../validators/exams";
import { z } from "zod";
import { createListHandler } from "../lib/express-prisma-query";
import { ExamStatus } from "../generated/prisma/client";

// ─── Shared select shape ──────────────────────────────────────────────────────

const examSelect = {
  id: true,
  type: true,
  status: true,
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

type ExamReadiness = {
  isReady: boolean;
  reason?: string;
};

const shuffleArray = <T>(items: T[]) => {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

const getExamReadiness = async (
  tx: any,
  examId: number,
): Promise<ExamReadiness> => {
  const exam = await tx.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      course_id: true,
      settings: {
        select: {
          id: true,
          students: {
            select: { student_id: true },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  if (exam.settings.length === 0) {
    return {
      isReady: false,
      reason: "Exam must have at least one exam setting",
    };
  }

  const enrolledStudents = await tx.studentCourse.findMany({
    where: { course_id: exam.course_id },
    select: { student_id: true },
  });

  const enrolledStudentIds: number[] = enrolledStudents.map(
    (student: { student_id: number }) => student.student_id,
  );
  const enrolledStudentIdSet = new Set(enrolledStudentIds);

  if (enrolledStudentIds.length < exam.settings.length) {
    return {
      isReady: false,
      reason: `Cannot mark exam as ready. The maximum number of exam settings for the currently enrolled students is ${enrolledStudentIds.length}`,
    };
  }

  const emptySetting = exam.settings.find(
    (setting: { students: { student_id: number }[] }) =>
      setting.students.length === 0,
  );

  if (emptySetting) {
    return {
      isReady: false,
      reason: "One or more exam locations has no assigned students",
    };
  }

  const assignmentCounts = new Map<number, number>();
  let assignmentsCount = 0;

  for (const setting of exam.settings as {
    students: { student_id: number }[];
  }[]) {
    for (const student of setting.students) {
      assignmentsCount++;
      assignmentCounts.set(
        student.student_id,
        (assignmentCounts.get(student.student_id) ?? 0) + 1,
      );
    }
  }

  const hasStudentAssignedMoreThanOnce = [...assignmentCounts.values()].some(
    (count) => count > 1,
  );

  if (hasStudentAssignedMoreThanOnce) {
    return {
      isReady: false,
      reason: "One or more students is assigned to multiple exam settings",
    };
  }

  const hasStudentOutsideCourse = [...assignmentCounts.keys()].some(
    (studentId) => !enrolledStudentIdSet.has(studentId),
  );

  if (hasStudentOutsideCourse) {
    return {
      isReady: false,
      reason:
        "One or more assigned students is not enrolled in this exam's course",
    };
  }

  const hasUnassignedStudent = enrolledStudentIds.some(
    (studentId) => !assignmentCounts.has(studentId),
  );

  if (hasUnassignedStudent) {
    return {
      isReady: false,
      reason:
        "Not all students enrolled in this exam's course are assigned to an exam setting",
    };
  }

  if (assignmentsCount !== enrolledStudentIds.length) {
    return {
      isReady: false,
      reason: "Exam student assignments are invalid",
    };
  }

  return { isReady: true };
};

const refreshExamStatus = async (tx: any, examId: number) => {
  const exam = await tx.exam.findUnique({
    where: { id: examId },
    select: { status: true },
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  if (exam.status === ExamStatus.PUBLISHED) {
    return ExamStatus.PUBLISHED;
  }

  const readiness = await getExamReadiness(tx, examId);
  const nextStatus = readiness.isReady ? ExamStatus.READY : ExamStatus.NOT_READY;

  await tx.exam.update({
    where: { id: examId },
    data: { status: nextStatus },
  });

  return nextStatus;
};

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
    status: "text",
  },
  searchableFields: [],
  findManyArgs: {
    select: examSelect,
  } as any,
  mapResult: ({ data }) => z.array(examResponseSchema).parse(data),
});

// ─── GET /exams/:id ───────────────────────────────────────────────────────────

export const getExamById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

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

// ─── GET /exam-settings/:id ───────────────────────────────────────────────────────────

export const getExamSettingById = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      throw new BadRequestError("Invalid exam setting ID");
    }

    const examSetting = await prisma.examSettings.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        start_time: true,
        end_time: true,
        location_id: true,
        location: true,
        exam: true,
        exam_id: true,
        students: {
          select: {
            student_id: true,
            mother_name: true,
            year_id: true,
            section_id: true,
            major_id: true,
            group_id: true,
            userId: true,
            user: {
              select: {
                id: true,
                full_name: true,
                username: true,
                email: true,
              },
            },
          },
        },
        created_at: true,
        updated_at: true,
      },
    });

    if (!examSetting) {
      throw new NotFoundError("Exam Setting");
    }

    const parsed = examSettingResponseSchema.parse(examSetting);

    return res.status(200).json({
      success: true,
      data: parsed,
    });
  },
);

// __ Post /exam-settings/delete-student/:id
export const deleteStudentFromExamSetting = asyncHandler(
  async (req: Request, res: Response) => {
    const examSettingId = parseInt(req.params.id as string, 10);
    const studentId = parseInt(req.body.student_id as string, 10);

    if (isNaN(examSettingId) || isNaN(studentId)) {
      throw new BadRequestError("Invalid exam setting ID or student ID");
    }

    // Validate exam setting exists and student is assigned to it
    const examSetting = await prisma.examSettings.findUnique({
      where: { id: examSettingId },
      include: {
        exam: { select: { id: true, status: true } },
        students: {
          where: { student_id: studentId },
          select: { student_id: true },
        },
      },
    });

    if (!examSetting) {
      throw new NotFoundError("Exam setting");
    }

    if (examSetting.exam.status === ExamStatus.PUBLISHED) {
      throw new BadRequestError("Published exams cannot be modified");
    }

    if (examSetting.students.length === 0) {
      throw new NotFoundError("Student is not assigned to this exam setting");
    }

    const updatedExam = await prisma.$transaction(async (tx) => {
      await tx.examSettings.update({
        where: { id: examSettingId },
        data: {
          students: {
            disconnect: { student_id: studentId },
          },
        },
      });

      await refreshExamStatus(tx, examSetting.exam_id);

      return tx.exam.findUnique({
        where: { id: examSetting.exam_id },
        select: examSelect,
      });
    });

    const parsed = examResponseSchema.parse(updatedExam);

    return res.status(200).json({
      success: true,
      message: "Student removed from exam setting successfully",
      data: parsed,
    });
  },
);

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
      `A ${data.exam_type.toLowerCase()} exam already exists for this course`,
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
          // location_id: s.location_id,
          location: { connect: { id: s.location_id } },
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

  if (existingExam.status === ExamStatus.PUBLISHED) {
    throw new BadRequestError("Published exams cannot be modified");
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
        `A ${checkType.toLowerCase()} exam already exists for this course`,
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

  const courseChanged =
    data.course_id !== undefined && data.course_id !== existingExam.course_id;
  const settingsChanged = data.settings !== undefined;

  const updated = await prisma.$transaction(async (tx) => {
    // Replace settings if provided (delete all + recreate)
    if (settingsChanged) {
      await tx.examSettings.deleteMany({ where: { exam_id: id } });
    } else if (courseChanged) {
      const settings = await tx.examSettings.findMany({
        where: { exam_id: id },
        select: { id: true },
      });

      for (const setting of settings) {
        await tx.examSettings.update({
          where: { id: setting.id },
          data: { students: { set: [] } },
        });
      }
    }

    return tx.exam.update({
      where: { id },
      data: {
        ...(data.course_id !== undefined && { course_id: data.course_id }),
        ...(data.exam_type !== undefined && { type: data.exam_type }),
        ...((courseChanged || settingsChanged) && {
          status: ExamStatus.NOT_READY,
        }),
        ...(settingsChanged && {
          settings: {
            create: data.settings!.map((s) => ({
              // location_id: s.location_id,
              location: { connect: { id: s.location_id } },
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
  const id = parseInt(req.params.id as string, 10);

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

// ─── POST /exams/:id/shuffle ──────────────────────────────────────────────────

export const shuffleExamStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = examIdParamsSchema.parse(req.params);

    const updatedExam = await prisma.$transaction(async (tx) => {
      const exam = await tx.exam.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          course_id: true,
          settings: {
            select: { id: true },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!exam) {
        throw new NotFoundError("Exam");
      }

      if (exam.status === ExamStatus.PUBLISHED) {
        throw new BadRequestError("Published exams cannot be shuffled");
      }

      if (exam.settings.length === 0) {
        throw new BadRequestError(
          "Exam must have at least one exam setting before shuffling",
        );
      }

      const enrolledStudents = await tx.studentCourse.findMany({
        where: { course_id: exam.course_id },
        select: { student_id: true },
      });
      const studentIds: number[] = enrolledStudents.map(
        (student: { student_id: number }) => student.student_id,
      );

      if (studentIds.length < exam.settings.length) {
        throw new BadRequestError(
          `Cannot shuffle students. The maximum number of exam settings for the currently enrolled students is ${studentIds.length}`,
        );
      }

      for (const setting of exam.settings) {
        await tx.examSettings.update({
          where: { id: setting.id },
          data: { students: { set: [] } },
        });
      }

      const shuffledStudentIds = shuffleArray(studentIds);
      const assignments = exam.settings.map((setting: { id: number }) => ({
        settingId: setting.id,
        studentIds: [] as number[],
      }));

      shuffledStudentIds.forEach((studentId, index) => {
        assignments[index % assignments.length].studentIds.push(studentId);
      });

      for (const assignment of assignments) {
        await tx.examSettings.update({
          where: { id: assignment.settingId },
          data: {
            students: {
              connect: assignment.studentIds.map((studentId) => ({ student_id: studentId })),
            },
          },
        });
      }

      return tx.exam.update({
        where: { id },
        data: { status: ExamStatus.READY },
        select: examSelect,
      });
    });

    const parsed = examResponseSchema.parse(updatedExam);

    return res.status(200).json({
      success: true,
      message: "Exam students shuffled successfully",
      data: parsed,
    });
  },
);

// ─── POST /exams/:id/publish ──────────────────────────────────────────────────

export const publishExam = asyncHandler(async (req: Request, res: Response) => {
  const { id } = examIdParamsSchema.parse(req.params);

  const updatedExam = await prisma.$transaction(async (tx) => {
    const exam = await tx.exam.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!exam) {
      throw new NotFoundError("Exam");
    }

    if (exam.status === ExamStatus.PUBLISHED) {
      throw new BadRequestError("Exam is already published");
    }

    const readiness = await getExamReadiness(tx, id);

    if (!readiness.isReady) {
      throw new BadRequestError(
        readiness.reason ?? "Exam is not ready to be published",
      );
    }

    if (exam.status === ExamStatus.NOT_READY) {
      throw new BadRequestError(
        "Exam is not ready to be published. Please shuffle or assign students first",
      );
    }

    // TODO: Send notifications to all assigned students with their exam date, time, and location.
    return tx.exam.update({
      where: { id },
      data: { status: ExamStatus.PUBLISHED },
      select: examSelect,
    });
  });

  const parsed = examResponseSchema.parse(updatedExam);

  return res.status(200).json({
    success: true,
    message: "Exam published successfully",
    data: parsed,
  });
});

// ─── POST /exam-settings/:id/students ────────────────────────────────────────

export const bulkAddStudentsToExamSetting = asyncHandler(
  async (req: Request, res: Response) => {
    const examSettingId = parseInt(req.params.id as string, 10);

    if (isNaN(examSettingId)) {
      throw new BadRequestError("Invalid exam setting ID");
    }

    const { student_ids } = bulkAddStudentsSchema.parse(req.body);
    const uniqueStudentIds = [...new Set(student_ids)];

    // Validate exam setting exists
    const examSetting = await prisma.examSettings.findUnique({
      where: { id: examSettingId },
      select: {
        id: true,
        exam_id: true,
        exam: {
          select: {
            id: true,
            status: true,
            course_id: true,
            settings: { select: { id: true } },
          },
        },
      },
    });

    if (!examSetting) {
      throw new NotFoundError("Exam setting");
    }

    if (examSetting.exam.status === ExamStatus.PUBLISHED) {
      throw new BadRequestError("Published exams cannot be modified");
    }

    // Validate all students exist
    const students = await prisma.student.findMany({
      where: { student_id: { in: uniqueStudentIds } },
      select: { student_id: true },
    });

    if (students.length !== uniqueStudentIds.length) {
      throw new NotFoundError("One or more students");
    }

    // Validate all students are enrolled in this exam's course
    const enrolledStudents = await prisma.studentCourse.findMany({
      where: {
        course_id: examSetting.exam.course_id,
        student_id: { in: uniqueStudentIds },
      },
      select: { student_id: true },
    });

    if (enrolledStudents.length !== uniqueStudentIds.length) {
      throw new BadRequestError(
        "One or more students is not enrolled in this exam's course",
      );
    }

    const updatedExam = await prisma.$transaction(async (tx) => {
      const settingsWithTargetStudents = await tx.examSettings.findMany({
        where: { exam_id: examSetting.exam_id },
        select: {
          id: true,
          students: {
            where: { student_id: { in: uniqueStudentIds } },
            select: { student_id: true },
          },
        },
      });

      for (const setting of settingsWithTargetStudents) {
        if (setting.students.length === 0) continue;

        await tx.examSettings.update({
          where: { id: setting.id },
          data: {
            students: {
              disconnect: setting.students.map(
                (student: { student_id: number }) => ({
                  student_id: student.student_id,
                }),
              ),
            },
          },
        });
      }

      await tx.examSettings.update({
        where: { id: examSettingId },
        data: {
          students: {
            connect: uniqueStudentIds.map((id) => ({ student_id: id })),
          },
        },
      });

      await refreshExamStatus(tx, examSetting.exam_id);

      return tx.exam.findUnique({
        where: { id: examSetting.exam_id },
        select: examSelect,
      });
    });

    const parsed = examResponseSchema.parse(updatedExam);

    return res.status(200).json({
      success: true,
      count: uniqueStudentIds.length,
      message: "Students added successfully",
      data: parsed,
    });
  },
);
