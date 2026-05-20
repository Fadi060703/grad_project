import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import {
  createMarksCourseSchema,
  getMarksCourseSchema,
  updateMarksCourseSchema,
} from "../validators/marksCourse";
import { z } from "zod";

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

  mapResult: ({ data }) => z.array(getMarksCourseSchema).parse(data),
});

export const createMarksCourse = async (req: Request, res: Response) => {
  try {
    const data = createMarksCourseSchema.parse(req.body);

    const existing = await prisma.marksCourse.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return res
        .status(409)
        .json({ error: "Marks course name already exists" });
    }

    const courses = await prisma.course.findMany({
      where: { id: { in: data.course_ids } },
      select: { id: true, marks_course_id: true },
    });

    if (courses.length !== data.course_ids.length) {
      return res.status(404).json({ error: "One or more courses not found" });
    }

    const conflicting = courses.filter(
      (course) => course.marks_course_id !== null,
    );

    if (conflicting.length > 0) {
      return res.status(409).json({
        error: "One or more courses already assigned to a marks course",
      });
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
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create marks course error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateMarksCourse = async (req: Request, res: Response) => {
  try {
    //@ts-expect-error
    const id = parseInt(req.params.id, 10);
    const data = updateMarksCourseSchema.parse(req.body);

    const existing = await prisma.marksCourse.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Marks course not found" });
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.marksCourse.findUnique({
        where: { name: data.name },
      });

      if (duplicate) {
        return res
          .status(409)
          .json({ error: "Marks course name already exists" });
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
          throw new Error("COURSE_NOT_FOUND");
        }

        const conflicting = courses.filter(
          (course) =>
            course.marks_course_id !== null && course.marks_course_id !== id,
        );

        if (conflicting.length > 0) {
          throw new Error("COURSE_CONFLICT");
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
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    if (err?.message === "COURSE_NOT_FOUND") {
      return res.status(404).json({ error: "One or more courses not found" });
    }
    if (err?.message === "COURSE_CONFLICT") {
      return res.status(409).json({
        error: "One or more courses already assigned to a marks course",
      });
    }
    console.error("Update marks course error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMarksCourse = async (req: Request, res: Response) => {
  try {
    //@ts-expect-error
    const id = parseInt(req.params.id, 10);

    const existing = await prisma.marksCourse.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Marks course not found" });
    }

    const deleted = await prisma.marksCourse.delete({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete marks course error:", err);
    return res.status(400).json({ error: err });
  }
};
