// validators/majors.ts

import { z } from 'zod';

export const getMajorsSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  year_id: z.number().positive(),
  year: z.object({
    id: z.number().positive(),
    name: z.string()
  }).optional(),
  groups: z.array(z.object({
    id: z.number().positive(),
    name: z.string()
  })).optional()
});

export const createMajorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters"),
  year_id: z.number().positive("Year ID must be a positive number")
});

export const updateMajorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters").optional(),
  year_id: z.number().positive("Year ID must be a positive number").optional()
});

// Export types
export type getMajorDTO = z.infer<typeof getMajorsSchema>;
export type createMajorDTO = z.infer<typeof createMajorSchema>;
export type updateMajorDTO = z.infer<typeof updateMajorSchema>;