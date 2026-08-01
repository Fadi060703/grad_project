import { z } from "zod";

const markItemSchema = z
  .object({
    course_id: z.number().positive(),
    student_id: z.number().positive(),
    practical_grade: z.number().int().min(0).max(100),
    theoretical_grade: z.number().int().min(0).max(100).default(0),
  })
  .refine((data) => data.practical_grade + data.theoretical_grade <= 100, {
    message: "Sum of practical and theoretical grades must be <= 100",
    path: ["theoretical_grade"],
  });

const markCourseSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  course_type: z.enum(["THEORITICAL_ONLY", "THEORITICAL_AND_PRACTICAL"]),
  exam_type: z.enum(["MSQ", "WRITTEN"]),
  theoretical_grade: z.number().int().min(0).max(100),
  practical_grade: z.number().int().min(0).max(100),
  is_practical_marks_published: z.boolean(),
  is_marks_published: z.boolean(),
  code: z.string().nullable(),
  year: z.object({
    id: z.number().positive(),
    name: z.string(),
  }),
});

const markStudentSchema = z.object({
  student_id: z.number().positive(),
  mother_name: z.string(),
  year: z.object({
    id: z.number().positive(),
    name: z.string(),
  }),
  user: z.object({
    full_name: z.string(),
    email: z.string().email().nullable(),
  }),
});

const markBaseSchema = z.object({
  id: z.number().positive(),
  course_id: z.number().positive(),
  course: markCourseSchema,
  academic_key: z.string(),
  practical_grade: z.number().int().min(0).max(100),
  theoretical_grade: z.number().int().min(0).max(100),
  total_grade: z.number().int().min(0).max(100),
  created_at: z.date().optional(),
  updated_at: z.date().optional().nullable(),
});

export const getMarksSchema = markBaseSchema.extend({
  student_id: z.number().positive(),
  student: markStudentSchema.optional(),
});

export const getMyStudentMarksSchema = markBaseSchema;

export const bulkCreateMarksSchema = z.object({
  marks: z.array(markItemSchema).min(1, "At least one mark is required"),
});

export const updateMarkSchema = z
  .object({
    course_id: z.number().positive().optional(),
    student_id: z.number().positive().optional(),
    practical_grade: z.number().int().min(0).max(100).optional(),
    theoretical_grade: z.number().int().min(0).max(100).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field is required",
  });

export const bulkDeleteMarksSchema = z.object({
  ids: z.array(z.number().positive()).min(1, "At least one id is required"),
});

export type getMarksDTO = z.infer<typeof getMarksSchema>;
export type bulkCreateMarksDTO = z.infer<typeof bulkCreateMarksSchema>;
export type updateMarkDTO = z.infer<typeof updateMarkSchema>;
export type bulkDeleteMarksDTO = z.infer<typeof bulkDeleteMarksSchema>;
