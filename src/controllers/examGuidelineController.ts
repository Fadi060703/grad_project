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
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError } from "../errors";

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

export const getExamGuidelineById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid exam guideline ID');
  }

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
    throw new NotFoundError('Exam guideline');
  }

  const parsed = getExamGuidelinesSchema.parse(guideline);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createExamGuideline = asyncHandler(async (req: Request, res: Response) => {
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

  return res.status(201).json({
    success: true,
    message: 'Exam guideline created successfully',
    data: created
  });
});

export const updateExamGuideline = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid exam guideline ID');
  }
  
  const data = updateExamGuidelineSchema.parse(req.body);

  const existingGuideline = await prisma.examGuideline.findUnique({
    where: { id },
  });

  if (!existingGuideline) {
    throw new NotFoundError('Exam guideline');
  }

  const updateData: {
    title?: string;
    description?: string;
    image?: string | null;
  } = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
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

  return res.status(200).json({
    success: true,
    message: 'Exam guideline updated successfully',
    data: updated
  });
});

export const deleteExamGuideline = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid exam guideline ID');
  }

  const existingGuideline = await prisma.examGuideline.findUnique({
    where: { id },
  });

  if (!existingGuideline) {
    throw new NotFoundError('Exam guideline');
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

  return res.status(200).json({
    success: true,
    message: 'Exam guideline deleted successfully',
    data: deleted
  });
});