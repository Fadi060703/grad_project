import { z } from "zod";

export const getFaculityInfoSchema = z.object({
  id: z.number().positive(),
  telegram_url: z.string().optional().nullable(),
  facebook_url: z.string().optional().nullable(),
  instagram_url: z.string().optional().nullable(),
  linkedin_url: z.string().optional().nullable(),
  website_url: z.string().optional().nullable(),
  university_name: z.string().optional().nullable(),
  faculity_name: z.string().optional().nullable(),
  faculity_picture_url: z.string().optional().nullable(),
  support_email: z.string().optional().nullable(),
  lectures_schedule_url: z.string().optional().nullable(),
  theoritical_exam_schedule_url: z.string().optional().nullable(),
  practical_exam_schedule_url: z.string().optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const updateFaculityInfoSchema = z.object({
  telegram_url: z.string().optional(),
  facebook_url: z.string().optional(),
  instagram_url: z.string().optional(),
  linkedin_url: z.string().optional(),
  website_url: z.string().optional(),
  university_name: z.string().optional(),
  faculity_name: z.string().optional(),
  faculity_picture_url: z.string().optional(),
  support_email: z.string().optional(),
  lectures_schedule_url: z.string().optional(),
  theoritical_exam_schedule_url: z.string().optional(),
  practical_exam_schedule_url: z.string().optional(),
});

export type getFaculityInfoDTO = z.infer<typeof getFaculityInfoSchema>;
export type updateFaculityInfoDTO = z.infer<typeof updateFaculityInfoSchema>;
