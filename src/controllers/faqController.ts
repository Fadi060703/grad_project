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

export const getFaqById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const faq = await prisma.fAQ.findUnique({
      where: { id },
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });

    if (!faq) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    const parsed = getFaqsSchema.parse(faq);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createFaq = async (req: Request, res: Response) => {
  try {
    const data = createFaqSchema.parse(req.body);

    if (!data.question && !data.answer) {
      return res
        .status(400)
        .json({ error: "Question or answer must be provided" });
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

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create FAQ error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateFaq = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateFaqSchema.parse(req.body);

    const existingFaq = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!existingFaq) {
      return res.status(404).json({ error: "FAQ not found" });
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

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update FAQ error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteFaq = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existingFaq = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!existingFaq) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    const deleted = await prisma.fAQ.delete({
      where: { id },
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });

    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete FAQ error:", err);
    return res.status(400).json({ error: err });
  }
};
