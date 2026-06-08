import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const examTypeSchema = z.enum(["THEORETICAL", "PRACTICAL"]);

// ─── ExamSettings ─────────────────────────────────────────────────────────────

const examSettingsInputSchema = z.object({
  location_id: z.number().int().positive(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
});

// ─── Create ───────────────────────────────────────────────────────────────────

export const createExamSchema = z.object({
  course_id: z.number().int().positive(),
  exam_type: examTypeSchema,
  settings: z
    .array(examSettingsInputSchema)
    .min(1, "At least one settings entry is required"),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateExamSchema = z
  .object({
    course_id: z.number().int().positive().optional(),
    exam_type: examTypeSchema.optional(),
    settings: z.array(examSettingsInputSchema).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// ─── Response shapes ──────────────────────────────────────────────────────────

export const examSettingsResponseSchema = z.object({
  id: z.number(),
  exam_id: z.number(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  location: z.object({
    id: z.number(),
    name: z.string(),
    reaching_description: z.string().nullable(),
  }),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const examResponseSchema = z.object({
  id: z.number(),
  exam_type: examTypeSchema,
  course_id: z.number(),
  course: z.object({
    id: z.number(),
    name: z.string(),
  }),
  settings: z.array(examSettingsResponseSchema),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type ExamResponse = z.infer<typeof examResponseSchema>;