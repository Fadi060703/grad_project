// validators/courses.ts

import { z } from "zod";

export const getCoursesSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  course_type: z.enum(["THEORITICAL_ONLY", "THEORITICAL_AND_PRACTICAL"]),
  exam_type: z.enum(["MSQ", "WRITTEN"]),
  theoretical_grade: z.number().int().min(0).max(100),
  practical_grade: z.number().int().min(0).max(100),
  year_id: z.number().positive(),
  year: z
    .object({
      id: z.number().positive(),
      name: z.string(),
      has_majors: z.boolean(),
    })
    .optional(),
  majors: z
    .array(
      z.object({
        id: z.number().positive(),
        name: z.string(),
        year_id: z.number().positive(),
        year: z
          .object({
            id: z.number().positive(),
            name: z.string(),
          })
          .optional(),
      }),
    )
    .optional(),
  sections: z
    .array(
      z.object({
        id: z.number().positive(),
        name: z.string(),
        year_id: z.number().positive(),
        year: z
          .object({
            id: z.number().positive(),
            name: z.string(),
          })
          .optional(),
      }),
    )
    .optional(),
  doctors: z
    .array(
      z.object({
        id: z.number().positive(),
        full_name: z.string(),
        username: z.string(),
        email: z.string().optional().nullable(),
      }),
    )
    .optional(),
  teachers: z
    .array(
      z.object({
        id: z.number().positive(),
        full_name: z.string(),
        username: z.string(),
        email: z.string().optional().nullable(),
      }),
    )
    .optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const createCourseSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(200, "Name must not exceed 200 characters"),
  course_type: z.enum(["THEORITICAL_ONLY", "THEORITICAL_AND_PRACTICAL"]),
  exam_type: z.enum(["MSQ", "WRITTEN"]),
  theoretical_grade: z
    .number()
    .int()
    .min(0, "Theoretical grade cannot be negative")
    .max(100, "Theoretical grade cannot exceed 100"),
  practical_grade: z
    .number()
    .int()
    .min(0, "Practical grade cannot be negative")
    .max(100, "Practical grade cannot exceed 100"),
  year_id: z.number().positive(),
  major_ids: z.array(z.number().positive()).optional(),
  section_ids: z.array(z.number().positive()).optional(),
  teachers_ids: z
    .array(z.number().positive())
    .min(1, "At least one teacher is required"),
  doctors_ids: z
    .array(z.number().positive())
    .min(1, "At least one doctor is required"),
});

export const updateCourseSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(200, "Name must not exceed 200 characters")
    .optional(),
  course_type: z
    .enum(["THEORITICAL_ONLY", "THEORITICAL_AND_PRACTICAL"])
    .optional(),
  exam_type: z.enum(["MSQ", "WRITTEN"]).optional(),
  theoretical_grade: z.number().int().min(0).max(100).optional(),
  practical_grade: z.number().int().min(0).max(100).optional(),
  year_id: z.number().positive().optional(),
  major_ids: z.array(z.number().positive()).optional(),
  section_ids: z.array(z.number().positive()).optional(),
  teachers_ids: z.array(z.number().positive()).optional(),
  doctors_ids: z.array(z.number().positive()).optional(),
});

// Export types
export type getCourseDTO = z.infer<typeof getCoursesSchema>;
export type createCourseDTO = z.infer<typeof createCourseSchema>;
export type updateCourseDTO = z.infer<typeof updateCourseSchema>;
