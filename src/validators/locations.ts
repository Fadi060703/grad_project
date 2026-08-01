// validators/university-locations.ts

import { z } from 'zod';

const photoArraySchema = z
  .array(z.string())
  .transform((items) => items.map((item) => item.trim()).filter(Boolean));

export const getUniversityLocationSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  reaching_description: z.string().optional().nullable(),
  photo_array: z.array(z.string()),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

export const createUniversityLocationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters"),
  reaching_description: z.string().optional().nullable(),
  photo_array: photoArraySchema.default([]),
});

export const updateUniversityLocationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters").optional(),
  reaching_description: z.string().optional().nullable(),
  photo_array: photoArraySchema.optional(),
});

// Export types
export type getUniversityLocationDTO = z.infer<typeof getUniversityLocationSchema>;
export type createUniversityLocationDTO = z.infer<typeof createUniversityLocationSchema>;
export type updateUniversityLocationDTO = z.infer<typeof updateUniversityLocationSchema>;