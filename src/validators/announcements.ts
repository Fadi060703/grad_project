// validators/announcements.ts

import { z } from 'zod';

export const getAnnouncementSchema = z.object({
  id: z.number().positive(),
  title: z.string(),
  content: z.string(),
  type: z.enum(["REGULAR", "IMPORTANT", "EMERGENCY"]),
  attachments: z.array(z.string()),
  year_id: z.number().positive().optional().nullable(),
  section_id: z.number().positive().optional().nullable(),
  major_id: z.number().positive().optional().nullable(),
  group_id: z.number().positive().optional().nullable(),
  course_id: z.number().positive().optional().nullable(),
  student_id: z.number().positive().optional().nullable(),
  year: z.object({
    id: z.number().positive(),
    name: z.string(),
  }).optional().nullable(),
  section: z.object({
    id: z.number().positive(),
    name: z.string(),
  }).optional().nullable(),
  major: z.object({
    id: z.number().positive(),
    name: z.string(),
  }).optional().nullable(),
  group: z.object({
    id: z.number().positive(),
    name: z.string(),
  }).optional().nullable(),
  course: z.object({
    id: z.number().positive(),
    name: z.string(),
  }).optional().nullable(),
  student: z.object({
    id: z.number().positive(),
    full_name: z.string(),
  }).optional().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must not exceed 200 characters"),
  content: z.string().min(10, "Content must be at least 10 characters").max(5000, "Content must not exceed 5000 characters"),
  type: z.enum(["REGULAR", "IMPORTANT", "EMERGENCY"]).default("REGULAR"),
  year_id: z.number().positive().optional(),
  section_id: z.number().positive().optional(),
  major_id: z.number().positive().optional(),
  group_id: z.number().positive().optional(),
  course_id: z.number().positive().optional(),
  student_id: z.number().positive().optional(),
  attachments: z.array(z.string()).default([]),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must not exceed 200 characters").optional(),
  content: z.string().min(10, "Content must be at least 10 characters").max(5000, "Content must not exceed 5000 characters").optional(),
  type: z.enum(["REGULAR", "IMPORTANT", "EMERGENCY"]).optional(),
  year_id: z.number().positive().optional().nullable(),
  section_id: z.number().positive().optional().nullable(),
  major_id: z.number().positive().optional().nullable(),
  group_id: z.number().positive().optional().nullable(),
  course_id: z.number().positive().optional().nullable(),
  student_id: z.number().positive().optional().nullable(),
  attachments: z.array(z.string()).optional(),
});

// Query schema for filtering announcements
export const getAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(10),
  type: z.enum(["REGULAR", "IMPORTANT", "EMERGENCY"]).optional(),
  year_id: z.coerce.number().positive().optional(),
  section_id: z.coerce.number().positive().optional(),
  major_id: z.coerce.number().positive().optional(),
  group_id: z.coerce.number().positive().optional(),
  course_id: z.coerce.number().positive().optional(),
  student_id: z.coerce.number().positive().optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Export types
export type getAnnouncementDTO = z.infer<typeof getAnnouncementSchema>;
export type createAnnouncementDTO = z.infer<typeof createAnnouncementSchema>;
export type updateAnnouncementDTO = z.infer<typeof updateAnnouncementSchema>;
export type getAnnouncementsQueryDTO = z.infer<typeof getAnnouncementsQuerySchema>;