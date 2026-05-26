// controllers/faqs.ts

import { Request, Response } from "express";
import {
  createFaqSchema,
  getFaqsSchema,
  updateFaqSchema,
} from "../validators/faq";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError } from "../errors";

export const getAllFaqs = createListHandler({
  prisma: prisma.fAQ,

  allowedSortFields: ["id", "question", "answer"],

  fieldTypes: {
    id: "number",
    question: "text",
    answer: "text",
  },

  searchableFields: ["question", "answer"],

  findManyArgs: {
    select: {
      id: true,
      question: true,
      answer: true,
    },
  } as any,

  mapResult: ({ data }) => z.array(getFaqsSchema).parse(data),
});

export const getFaqById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid FAQ ID');
  }

  const faq = await prisma.fAQ.findUnique({
    where: { id },
    select: {
      id: true,
      question: true,
      answer: true,
    },
  });

  if (!faq) {
    throw new NotFoundError('FAQ');
  }

  const parsed = getFaqsSchema.parse(faq);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createFaq = asyncHandler(async (req: Request, res: Response) => {
  const data = createFaqSchema.parse(req.body);

  if (!data.question && !data.answer) {
    throw new BadRequestError('Question or answer must be provided');
  }

  const created = await prisma.fAQ.create({
    data: {
      question: data.question ?? null,
      answer: data.answer ?? null,
    },
    select: {
      id: true,
      question: true,
      answer: true,
    },
  });

  return res.status(201).json({
    success: true,
    message: 'FAQ created successfully',
    data: created
  });
});

export const updateFaq = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid FAQ ID');
  }
  
  const data = updateFaqSchema.parse(req.body);

  const existingFaq = await prisma.fAQ.findUnique({
    where: { id },
  });

  if (!existingFaq) {
    throw new NotFoundError('FAQ');
  }

  const updateData: { question?: string | null; answer?: string | null } = {};

  if (data.question !== undefined) updateData.question = data.question;
  if (data.answer !== undefined) updateData.answer = data.answer;

  const updated = await prisma.fAQ.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      question: true,
      answer: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'FAQ updated successfully',
    data: updated
  });
});

export const deleteFaq = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid FAQ ID');
  }

  const existingFaq = await prisma.fAQ.findUnique({
    where: { id },
  });

  if (!existingFaq) {
    throw new NotFoundError('FAQ');
  }

  const deleted = await prisma.fAQ.delete({
    where: { id },
    select: {
      id: true,
      question: true,
      answer: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'FAQ deleted successfully',
    data: deleted
  });
});