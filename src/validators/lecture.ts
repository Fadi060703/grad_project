// validators/lecture.ts

import { z } from "zod";

const WeekDay = z.enum(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"]);
const LectureType = z.enum(["THEORETICAL", "PRACTICAL"]);

export const createLectureSchema = z.object({
  day: WeekDay,
  time_box_order: z.number().int().min(1).max(4),
  lecture_type: LectureType,
  course_id: z.number().int().positive(),
  location_id: z.number().int().positive(),
  instructor_id: z.number().int().positive(),
  section_id: z.number().int().positive().optional(),
  major_id: z.number().int().positive().optional(),
  group_id: z.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  // Must have exactly one of section_id or major_id
  const hasSection = data.section_id !== undefined;
  const hasMajor = data.major_id !== undefined;

  if (!hasSection && !hasMajor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either section_id or major_id must be provided",
    });
  }

  if (hasSection && hasMajor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot provide both section_id and major_id",
    });
  }

  // group_id is only allowed for practical lectures
  if (data.group_id !== undefined && data.lecture_type !== "PRACTICAL") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "group_id can only be provided for PRACTICAL lectures",
    });
  }
});

export const updateLectureSchema = z.object({
  location_id: z.number().int().positive().optional(),
  instructor_id: z.number().int().positive().optional(),
  group_id: z.number().int().positive().optional(),
}).strict();

export const getLectureSchema = z.object({
  id: z.number().int().positive(),
  day: WeekDay,
  time_box_order: z.number().int(),
  lecture_type: LectureType,
  course_id: z.number().int(),
  location_id: z.number().int(),
  instructor_id: z.number().int(),
  section_id: z.number().int().nullable().optional(),
  major_id: z.number().int().nullable().optional(),
  group_id: z.number().int().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export type CreateLectureDTO = z.infer<typeof createLectureSchema>;
export type UpdateLectureDTO = z.infer<typeof updateLectureSchema>;
export type GetLectureDTO = z.infer<typeof getLectureSchema>;