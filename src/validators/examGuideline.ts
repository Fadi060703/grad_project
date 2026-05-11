// validators/examGuideline.ts

import { z } from "zod";

export const getExamGuidelinesSchema = z.object({
  id: z.number().positive(),
  title: z.string(),
  description: z.string(),
  image: z.string().optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const createExamGuidelineSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters"),
  description: z
    .string()
    .min(3, "Description must be at least 3 characters")
    .max(20000, "Description must not exceed 20000 characters"),
  image: z.string().optional().nullable(),
});

export const updateExamGuidelineSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters")
    .optional(),
  description: z
    .string()
    .min(3, "Description must be at least 3 characters")
    .max(20000, "Description must not exceed 20000 characters")
    .optional(),
  image: z.string().optional().nullable(),
});

// Export types
export type getExamGuidelineDTO = z.infer<typeof getExamGuidelinesSchema>;
export type createExamGuidelineDTO = z.infer<typeof createExamGuidelineSchema>;
export type updateExamGuidelineDTO = z.infer<typeof updateExamGuidelineSchema>;
