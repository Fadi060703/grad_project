import { z } from "zod";

export const getCourseFileSchema = z.object({
  id: z.number().positive(),
  course_id: z.number().int().positive(),
  type: z.enum(["THEORETICAL", "PRACTICAL"]),
  file: z.string(),
  size: z.number().int().nonnegative(),
  title: z.string().min(1),
  mime_type: z.string().min(1),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const createCourseFileSchema = z.object({
  type: z.enum(["THEORETICAL", "PRACTICAL"]),
  file: z.string().min(1),
  size: z.number().int().nonnegative(),
  title: z.string().min(1),
  mime_type: z.string().min(1),
});

export const updateCourseFileSchema = z.object({
  type: z.enum(["THEORETICAL", "PRACTICAL"]).optional(),
  file: z.string().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
  title: z.string().min(1).optional(),
  mime_type: z.string().min(1).optional(),
});

export type getCourseFileDTO = z.infer<typeof getCourseFileSchema>;
export type createCourseFileDTO = z.infer<typeof createCourseFileSchema>;
export type updateCourseFileDTO = z.infer<typeof updateCourseFileSchema>;
