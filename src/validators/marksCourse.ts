import { z } from "zod";

export const getMarksCourseSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  courses: z
    .array(
      z.object({
        id: z.number().positive(),
        name: z.string(),
      }),
    )
    .optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const createMarksCourseSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must not exceed 200 characters"),
  course_ids: z
    .array(z.number().positive())
    .min(1, "At least one course is required"),
});

export const updateMarksCourseSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must not exceed 200 characters")
    .optional(),
  course_ids: z.array(z.number().positive()).min(1).optional(),
});

export type getMarksCourseDTO = z.infer<typeof getMarksCourseSchema>;
export type createMarksCourseDTO = z.infer<typeof createMarksCourseSchema>;
export type updateMarksCourseDTO = z.infer<typeof updateMarksCourseSchema>;
