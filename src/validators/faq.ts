// validators/faq.ts

import { z } from "zod";

export const getFaqsSchema = z.object({
  id: z.number().positive(),
  question: z.string().optional().nullable(),
  answer: z.string().optional().nullable(),
});

export const createFaqSchema = z.object({
  question: z
    .string()
    .min(2, "Question must be at least 2 characters")
    .max(500, "Question must not exceed 500 characters")
    .optional(),
  answer: z
    .string()
    .min(2, "Answer must be at least 2 characters")
    .max(2000, "Answer must not exceed 2000 characters")
    .optional(),
});

export const updateFaqSchema = z.object({
  question: z
    .string()
    .min(2, "Question must be at least 2 characters")
    .max(500, "Question must not exceed 500 characters")
    .optional(),
  answer: z
    .string()
    .min(2, "Answer must be at least 2 characters")
    .max(2000, "Answer must not exceed 2000 characters")
    .optional(),
});

// Export types
export type getFaqDTO = z.infer<typeof getFaqsSchema>;
export type createFaqDTO = z.infer<typeof createFaqSchema>;
export type updateFaqDTO = z.infer<typeof updateFaqSchema>;
