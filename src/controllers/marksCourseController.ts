import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import {
  createMarksCourseSchema,
  getMarksCourseSchema,
  updateMarksCourseSchema,
} from "../validators/marksCourse";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ConflictError, NotFoundError } from "../errors";

export const getAllMarksCourses = createListHandler({
  prisma: prisma.marksCourse,

  allowedSortFields: ["id", "name", "created_at", "updated_at"],

  fieldTypes: {
    id: "number",
    name: "text",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["name"],

  findManyArgs: {
    select: {
      id: true,
      name: true,
      courses: {
        select: {
          id: true,
          name: true,
        },
      },
      created_at: true,
      updated_at: true,
    },
  } as any,

  querySchema: z.object({
    year_id: z.coerce.number().positive().optional(),
  }),

  handleFindArgs: ({ query, findManyArgs }) => {
    if (!query.year_id) return {};

    return {
      where: {
        AND: [
          findManyArgs.where,
          {
            courses: {
              some: {
                OR: [
                  { section: { year_id: query.year_id } },
                  { major: { year_id: query.year_id } },
                ],
              },
            },
          },
        ],
      },
    };
  },

  mapResult: ({ data }) => z.array(getMarksCourseSchema).parse(data),
});

export const createMarksCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const data = createMarksCourseSchema.parse(req.body);

    const existing = await prisma.marksCourse.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictError("Marks course name already exists");
    }

    const courses = await prisma.course.findMany({
      where: { id: { in: data.course_ids } },
      select: { id: true, marks_course_id: true },
    });

    if (courses.length !== data.course_ids.length) {
      throw new NotFoundError("Course");
    }

    const conflicting = courses.filter(
      (course) => course.marks_course_id !== null,
    );

    if (conflicting.length > 0) {
      throw new ConflictError(
        "One or more courses already assigned to a marks course",
      );
    }

    const created = await prisma.marksCourse.create({
      data: {
        name: data.name,
        courses: {
          connect: data.course_ids.map((id) => ({ id })),
        },
      },
      select: {
        id: true,
        name: true,
        courses: {
          select: {
            id: true,
            name: true,
          },
        },
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(201).json(created);
  },
);

export const updateMarksCourse = asyncHandler(
  async (req: Request, res: Response) => {
    //@ts-expect-error
    const id = parseInt(req.params.id, 10);
    const data = updateMarksCourseSchema.parse(req.body);

    const existing = await prisma.marksCourse.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Marks course");
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.marksCourse.findUnique({
        where: { name: data.name },
      });

      if (duplicate) {
        throw new ConflictError("Marks course name already exists");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.marksCourse.update({
        where: { id },
        data: {
          name: data.name,
        },
      });

      if (data.course_ids) {
        const courses = await tx.course.findMany({
          where: { id: { in: data.course_ids } },
          select: { id: true, marks_course_id: true },
        });

        if (courses.length !== data.course_ids.length) {
          throw new NotFoundError("Course");
        }

        const conflicting = courses.filter(
          (course) =>
            course.marks_course_id !== null && course.marks_course_id !== id,
        );

        if (conflicting.length > 0) {
          throw new ConflictError(
            "One or more courses already assigned to a marks course",
          );
        }

        await tx.course.updateMany({
          where: { marks_course_id: id },
          data: { marks_course_id: null },
        });

        await tx.course.updateMany({
          where: { id: { in: data.course_ids } },
          data: { marks_course_id: id },
        });
      }

      return tx.marksCourse.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          courses: {
            select: {
              id: true,
              name: true,
            },
          },
          created_at: true,
          updated_at: true,
        },
      });
    });

    return res.status(200).json(updated);
  },
);

export const deleteMarksCourse = asyncHandler(
  async (req: Request, res: Response) => {
    //@ts-expect-error
    const id = parseInt(req.params.id, 10);

    const existing = await prisma.marksCourse.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Marks course");
    }

    const deleted = await prisma.marksCourse.delete({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    return res.status(200).json(deleted);
  },
);
