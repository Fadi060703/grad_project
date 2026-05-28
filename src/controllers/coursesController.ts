// controllers/courses.ts

import { Request, Response } from "express";
import {
  createCourseSchema,
  getCoursesSchema,
  updateCourseSchema,
} from "../validators/courses";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";

const mapCourseLinks = (course: any) => {
  const sections = Array.isArray(course.sectionCourses)
    ? course.sectionCourses.map((link: any) => link.section)
    : [];
  const majors = Array.isArray(course.majorCourses)
    ? course.majorCourses.map((link: any) => link.major)
    : [];

  const { sectionCourses, majorCourses, ...rest } = course;
  return {
    ...rest,
    sections,
    majors,
  };
};

const normalizeIds = (ids: number[]) => Array.from(new Set(ids));

export const getAllCourses = createListHandler({
  prisma: prisma.course,

  allowedSortFields: [
    "id",
    "name",
    "course_type",
    "exam_type",
    "theoretical_grade",
    "practical_grade",
    "created_at",
    "updated_at",
  ],

  fieldTypes: {
    id: "number",
    name: "text",
    course_type: "text",
    exam_type: "text",
    theoretical_grade: "number",
    practical_grade: "number",
    year_id: "number",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["name"],

  findManyArgs: {
    select: {
      id: true,
      name: true,
      course_type: true,
      exam_type: true,
      theoretical_grade: true,
      practical_grade: true,
      year_id: true,
      year: {
        select: {
          id: true,
          name: true,
          has_majors: true,
        },
      },
      majorCourses: {
        select: {
          major: {
            select: {
              id: true,
              name: true,
              year_id: true,
              year: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      sectionCourses: {
        select: {
          section: {
            select: {
              id: true,
              name: true,
              year_id: true,
              year: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      doctors: {
        select: {
          id: true,
          full_name: true,
          username: true,
          email: true,
        },
      },
      teachers: {
        select: {
          id: true,
          full_name: true,
          username: true,
          email: true,
        },
      },
      created_at: true,
      updated_at: true,
    },
  } as any,

  mapResult: ({ data }) =>
    z
      .array(getCoursesSchema)
      .parse(data.map((course) => mapCourseLinks(course))),
});

export const getCourseById = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      throw new BadRequestError("Invalid course ID");
    }

    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        year_id: true,
        year: {
          select: {
            id: true,
            name: true,
          },
        },
        majorCourses: {
          select: {
            major: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        sectionCourses: {
          select: {
            section: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          },
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          },
        },
        created_at: true,
        updated_at: true,
      },
    });

    if (!course) {
      throw new NotFoundError("Course");
    }

    const parsed = getCoursesSchema.parse(mapCourseLinks(course));

    return res.status(200).json({
      success: true,
      data: parsed,
    });
  },
);

export const createCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const data = createCourseSchema.parse(req.body);

    const year = await prisma.year.findUnique({
      where: { id: data.year_id },
      select: { id: true, has_majors: true },
    });

    if (!year) {
      throw new NotFoundError("Year");
    }

    if (year.has_majors && data.section_ids !== undefined) {
      throw new BadRequestError(
        "section_ids is not allowed for years with majors",
      );
    }

    if (!year.has_majors && data.major_ids !== undefined) {
      throw new BadRequestError(
        "major_ids is not allowed for years without majors",
      );
    }

    // Validate teachers exist
    const teachers = await prisma.user.findMany({
      where: {
        id: { in: data.teachers_ids },
        role: "TEACHER",
      },
    });

    if (teachers.length !== data.teachers_ids.length) {
      throw new NotFoundError(
        "One or more teachers not found or have incorrect role",
      );
    }

    // Validate doctors exist
    const doctors = await prisma.user.findMany({
      where: {
        id: { in: data.doctors_ids },
        role: "DOCTOR",
      },
    });

    if (doctors.length !== data.doctors_ids.length) {
      throw new NotFoundError(
        "One or more doctors not found or have incorrect role",
      );
    }

    // Check for duplicate course
    const existing = await prisma.course.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictError("Course with this name already exists");
    }

    let majorIds: number[] = [];
    let sectionIds: number[] = [];

    if (year.has_majors) {
      if (data.major_ids !== undefined) {
        majorIds = normalizeIds(data.major_ids);
      } else {
        const majors = await prisma.major.findMany({
          where: { year_id: year.id },
          select: { id: true },
        });
        majorIds = majors.map((major) => major.id);
      }

      if (majorIds.length > 0) {
        const majors = await prisma.major.findMany({
          where: { id: { in: majorIds }, year_id: year.id },
          select: { id: true },
        });

        if (majors.length !== majorIds.length) {
          throw new NotFoundError("Major");
        }
      }
    } else {
      if (data.section_ids !== undefined) {
        sectionIds = normalizeIds(data.section_ids);
      } else {
        const sections = await prisma.section.findMany({
          where: { year_id: year.id },
          select: { id: true },
        });
        sectionIds = sections.map((section) => section.id);
      }

      if (sectionIds.length > 0) {
        const sections = await prisma.section.findMany({
          where: { id: { in: sectionIds }, year_id: year.id },
          select: { id: true },
        });

        if (sections.length !== sectionIds.length) {
          throw new NotFoundError("Section");
        }
      }
    }

    const created = await prisma.course.create({
      data: {
        name: data.name,
        course_type: data.course_type,
        exam_type: data.exam_type,
        theoretical_grade: data.theoretical_grade,
        practical_grade: data.practical_grade,
        year_id: year.id,
        majorCourses: majorIds.length
          ? { create: majorIds.map((id) => ({ major_id: id })) }
          : undefined,
        sectionCourses: sectionIds.length
          ? { create: sectionIds.map((id) => ({ section_id: id })) }
          : undefined,
        doctors: {
          connect: data.doctors_ids.map((id) => ({ id })),
        },
        teachers: {
          connect: data.teachers_ids.map((id) => ({ id })),
        },
      },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        year_id: true,
        year: {
          select: {
            id: true,
            name: true,
          },
        },
        majorCourses: {
          select: {
            major: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        sectionCourses: {
          select: {
            section: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          },
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          },
        },
        created_at: true,
        updated_at: true,
      },
    });

    const parsed = getCoursesSchema.parse(mapCourseLinks(created));

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: parsed,
    });
  },
);

export const updateCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      throw new BadRequestError("Invalid course ID");
    }

    const data = updateCourseSchema.parse(req.body);

    // Check if course exists
    const existingCourse = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        year_id: true,
      },
    });

    if (!existingCourse) {
      throw new NotFoundError("Course");
    }

    const targetYearId = data.year_id ?? existingCourse.year_id;
    const year = await prisma.year.findUnique({
      where: { id: targetYearId },
      select: { id: true, has_majors: true },
    });

    if (!year) {
      throw new NotFoundError("Year");
    }

    if (data.major_ids !== undefined && data.section_ids !== undefined) {
      throw new BadRequestError(
        "Provide either major_ids or section_ids, not both",
      );
    }

    if (year.has_majors && data.section_ids !== undefined) {
      throw new BadRequestError(
        "section_ids is not allowed for years with majors",
      );
    }

    if (!year.has_majors && data.major_ids !== undefined) {
      throw new BadRequestError(
        "major_ids is not allowed for years without majors",
      );
    }

    // Validate and update teachers if provided
    if (data.teachers_ids) {
      const teachers = await prisma.user.findMany({
        where: {
          id: { in: data.teachers_ids },
          role: "TEACHER",
        },
      });

      if (teachers.length !== data.teachers_ids.length) {
        throw new NotFoundError(
          "One or more teachers not found or have incorrect role",
        );
      }
    }

    // Validate and update doctors if provided
    if (data.doctors_ids) {
      const doctors = await prisma.user.findMany({
        where: {
          id: { in: data.doctors_ids },
          role: "DOCTOR",
        },
      });

      if (doctors.length !== data.doctors_ids.length) {
        throw new NotFoundError(
          "One or more doctors not found or have incorrect role",
        );
      }
    }

    // Check for duplicate course name
    if (data.name && data.name !== existingCourse.name) {
      const duplicate = await prisma.course.findUnique({
        where: { name: data.name },
      });

      if (duplicate) {
        throw new ConflictError("Course with this name already exists");
      }
    }

    let majorIdsToSet: number[] = [];
    let sectionIdsToSet: number[] = [];

    if (year.has_majors) {
      if (data.major_ids !== undefined && data.major_ids.length > 0) {
        majorIdsToSet = normalizeIds(data.major_ids);
      } else {
        const majors = await prisma.major.findMany({
          where: { year_id: year.id },
          select: { id: true },
        });
        majorIdsToSet = majors.map((major) => major.id);
      }

      if (majorIdsToSet.length > 0) {
        const majors = await prisma.major.findMany({
          where: { id: { in: majorIdsToSet }, year_id: year.id },
          select: { id: true },
        });
        if (majors.length !== majorIdsToSet.length) {
          throw new NotFoundError("Major");
        }
      }
    } else {
      if (data.section_ids !== undefined && data.section_ids.length > 0) {
        sectionIdsToSet = normalizeIds(data.section_ids);
      } else {
        const sections = await prisma.section.findMany({
          where: { year_id: year.id },
          select: { id: true },
        });
        sectionIdsToSet = sections.map((section) => section.id);
      }

      if (sectionIdsToSet.length > 0) {
        const sections = await prisma.section.findMany({
          where: { id: { in: sectionIdsToSet }, year_id: year.id },
          select: { id: true },
        });
        if (sections.length !== sectionIdsToSet.length) {
          throw new NotFoundError("Section");
        }
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.course_type !== undefined)
      updateData.course_type = data.course_type;
    if (data.exam_type !== undefined) updateData.exam_type = data.exam_type;
    if (data.theoretical_grade !== undefined)
      updateData.theoretical_grade = data.theoretical_grade;
    if (data.practical_grade !== undefined)
      updateData.practical_grade = data.practical_grade;
    if (data.year_id !== undefined) updateData.year_id = targetYearId;

    if (year.has_majors) {
      updateData.majorCourses = {
        deleteMany: {},
        ...(majorIdsToSet.length > 0
          ? { create: majorIdsToSet.map((major_id) => ({ major_id })) }
          : {}),
      };
      updateData.sectionCourses = { deleteMany: {} };
    } else {
      updateData.sectionCourses = {
        deleteMany: {},
        ...(sectionIdsToSet.length > 0
          ? { create: sectionIdsToSet.map((section_id) => ({ section_id })) }
          : {}),
      };
      updateData.majorCourses = { deleteMany: {} };
    }

    // Handle relations
    if (data.teachers_ids) {
      updateData.teachers = {
        set: data.teachers_ids.map((id) => ({ id })),
      };
    }

    if (data.doctors_ids) {
      updateData.doctors = {
        set: data.doctors_ids.map((id) => ({ id })),
      };
    }

    const updated = await prisma.course.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        year_id: true,
        year: {
          select: {
            id: true,
            name: true,
          },
        },
        majorCourses: {
          select: {
            major: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        sectionCourses: {
          select: {
            section: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          },
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          },
        },
        created_at: true,
        updated_at: true,
      },
    });

    const parsed = getCoursesSchema.parse(mapCourseLinks(updated));

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: parsed,
    });
  },
);

export const deleteCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      throw new BadRequestError("Invalid course ID");
    }

    const existingCourse = await prisma.course.findUnique({
      where: { id },
    });

    if (!existingCourse) {
      throw new NotFoundError("Course");
    }

    const deleted = await prisma.course.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
      data: deleted,
    });
  },
);

// Get courses by major
export const getCoursesByMajor = asyncHandler(
  async (req: Request, res: Response) => {
    const major_id = parseInt(req.params.major_id as string, 10);

    if (isNaN(major_id)) {
      throw new BadRequestError("Invalid major ID");
    }

    const courses = await prisma.course.findMany({
      where: {
        majorCourses: {
          some: { major_id },
        },
      },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        year_id: true,
        year: {
          select: {
            id: true,
            name: true,
          },
        },
        majorCourses: {
          select: {
            major: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        sectionCourses: {
          select: {
            section: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        },
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const parsed = z
      .array(getCoursesSchema)
      .parse(courses.map((course) => mapCourseLinks(course)));

    return res.status(200).json({
      success: true,
      data: parsed,
      count: parsed.length,
    });
  },
);

// Get courses by section
export const getCoursesBySection = asyncHandler(
  async (req: Request, res: Response) => {
    const section_id = parseInt(req.params.section_id as string, 10);

    if (isNaN(section_id)) {
      throw new BadRequestError("Invalid section ID");
    }

    const courses = await prisma.course.findMany({
      where: {
        sectionCourses: {
          some: { section_id },
        },
      },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        year_id: true,
        year: {
          select: {
            id: true,
            name: true,
          },
        },
        majorCourses: {
          select: {
            major: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        sectionCourses: {
          select: {
            section: {
              select: {
                id: true,
                name: true,
                year_id: true,
                year: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        },
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const parsed = z
      .array(getCoursesSchema)
      .parse(courses.map((course) => mapCourseLinks(course)));

    return res.status(200).json({
      success: true,
      data: parsed,
      count: parsed.length,
    });
  },
);
