import { z } from "zod";

const markItemSchema = z
  .object({
    marks_course_id: z.number().positive(),
    student_id: z.number().positive(),
    practical_grade: z.number().int().min(0).max(100),
    theoretical_grade: z.number().int().min(0).max(100),
  })
  .refine((data) => data.practical_grade + data.theoretical_grade <= 100, {
    message: "Sum of practical and theoretical grades must be <= 100",
    path: ["theoretical_grade"],
  });

export const getMarksSchema = z.object({
  id: z.number().positive(),
  marks_course_id: z.number().positive(),
  student_id: z.number().positive(),
  practical_grade: z.number().int().min(0).max(100),
  theoretical_grade: z.number().int().min(0).max(100),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const bulkCreateMarksSchema = z.object({
  marks: z.array(markItemSchema).min(1, "At least one mark is required"),
});

export const updateMarkSchema = z.object({
  marks_course_id: z.number().positive().optional(),
  student_id: z.number().positive().optional(),
  practical_grade: z.number().int().min(0).max(100).optional(),
  theoretical_grade: z.number().int().min(0).max(100).optional(),
});

export const bulkDeleteMarksSchema = z.object({
  ids: z.array(z.number().positive()).min(1, "At least one id is required"),
});

export type getMarksDTO = z.infer<typeof getMarksSchema>;
export type bulkCreateMarksDTO = z.infer<typeof bulkCreateMarksSchema>;
export type updateMarkDTO = z.infer<typeof updateMarkSchema>;
export type bulkDeleteMarksDTO = z.infer<typeof bulkDeleteMarksSchema>;
