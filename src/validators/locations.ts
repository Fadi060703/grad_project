// validators/university-locations.ts

import { z } from 'zod';

export const getUniversityLocationSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  reaching_description: z.string().optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

export const createUniversityLocationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters"),
  reaching_description: z.string().optional().nullable()
});

export const updateUniversityLocationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters").optional(),
  reaching_description: z.string().optional().nullable()
});

// Export types
export type getUniversityLocationDTO = z.infer<typeof getUniversityLocationSchema>;
export type createUniversityLocationDTO = z.infer<typeof createUniversityLocationSchema>;
export type updateUniversityLocationDTO = z.infer<typeof updateUniversityLocationSchema>;