// controllers/exam-guidelines.ts

import { Request, Response } from "express";
import {
  createExamGuidelineSchema,
  getExamGuidelinesSchema,
  updateExamGuidelineSchema,
} from "../validators/examGuideline";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";

export const getAllExamGuidelines = createListHandler({
  prisma: prisma.examGuideline,

  allowedSortFields: ["id", "title", "created_at", "updated_at"],

  fieldTypes: {
    id: "number",
    title: "text",
    description: "text",
    image: "text",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["title", "description"],

  findManyArgs: {
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      created_at: true,
      updated_at: true,
    },
  } as any,

  mapResult: ({ data }) => z.array(getExamGuidelinesSchema).parse(data),
});

export const getExamGuidelineById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const guideline = await prisma.examGuideline.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!guideline) {
      return res.status(404).json({ error: "Exam guideline not found" });
    }

    const parsed = getExamGuidelinesSchema.parse(guideline);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createExamGuideline = async (req: Request, res: Response) => {
  try {
    const data = createExamGuidelineSchema.parse(req.body);

    const created = await prisma.examGuideline.create({
      data: {
        title: data.title,
        description: data.description,
        image: data.image ?? null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create exam guideline error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateExamGuideline = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateExamGuidelineSchema.parse(req.body);

    const existingGuideline = await prisma.examGuideline.findUnique({
      where: { id },
    });

    if (!existingGuideline) {
      return res.status(404).json({ error: "Exam guideline not found" });
    }

    const updateData: {
      title?: string;
      description?: string;
      image?: string | null;
    } = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.image !== undefined) updateData.image = data.image;

    const updated = await prisma.examGuideline.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update exam guideline error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteExamGuideline = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existingGuideline = await prisma.examGuideline.findUnique({
      where: { id },
    });

    if (!existingGuideline) {
      return res.status(404).json({ error: "Exam guideline not found" });
    }

    const deleted = await prisma.examGuideline.delete({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
      },
    });

    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete exam guideline error:", err);
    return res.status(400).json({ error: err });
  }
};
