// validators/system-settings.ts

import { z } from 'zod';

export const getSystemSettingsSchema = z.object({
  id: z.number().positive(),
  lecture_duration: z.number().int().positive().optional().nullable(),
  lectures_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (expected HH:MM)").optional().nullable(),
  aided_pass_courses_number: z.number().int().min(0).optional().nullable(),
  aided_marks_number: z.number().int().min(0).optional().nullable(),
  theoretical_exam_date: z.string().datetime().or(z.date()).optional().nullable(),
  practical_exam_date: z.string().datetime().or(z.date()).optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

export const createSystemSettingsSchema = z.object({
  lecture_duration: z.number().int().positive().min(30, "Lecture duration must be at least 30 minutes").max(180, "Lecture duration must not exceed 180 minutes").optional(),
  lectures_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (expected HH:MM)").optional(),
  aided_pass_courses_number: z.number().int().min(0, "Cannot be negative").max(20, "Cannot exceed 20 courses").optional(),
  aided_marks_number: z.number().int().min(0, "Cannot be negative").max(100, "Cannot exceed 100 marks").optional(),
  theoretical_exam_date: z.string().datetime().or(z.date()).optional(),
  practical_exam_date: z.string().datetime().or(z.date()).optional()
});

export const updateSystemSettingsSchema = z.object({
  lecture_duration: z.number().int().positive().min(30, "Lecture duration must be at least 30 minutes").max(180, "Lecture duration must not exceed 180 minutes").optional(),
  lectures_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (expected HH:MM)").optional(),
  aided_pass_courses_number: z.number().int().min(0, "Cannot be negative").max(20, "Cannot exceed 20 courses").optional(),
  aided_marks_number: z.number().int().min(0, "Cannot be negative").max(100, "Cannot exceed 100 marks").optional(),
  theoretical_exam_date: z.string().datetime().or(z.date()).optional(),
  practical_exam_date: z.string().datetime().or(z.date()).optional()
});

// Export types
export type getSystemSettingsDTO = z.infer<typeof getSystemSettingsSchema>;
export type createSystemSettingsDTO = z.infer<typeof createSystemSettingsSchema>;
export type updateSystemSettingsDTO = z.infer<typeof updateSystemSettingsSchema>;