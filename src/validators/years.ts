// validators/years.ts

import { z } from "zod";
import { getSectionsSchema } from "./sections";

export const yearSchema = z.object({
  id: z.number(),
  name: z.string(),
  order: z.number().int().positive(),
  has_majors: z.boolean(),
  sections: z.array(getSectionsSchema).optional(),
  majors: z.array(z.any()).optional(),
});

export const createYearSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  order: z.number().int().positive("Order must be a positive integer"),
  has_majors: z.boolean().default(false),
});

export const updateYearSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  order: z.number().int().positive("Order must be a positive integer").optional(),
  has_majors: z.boolean().optional(),
});

// Export types
export type yearDTO = z.infer<typeof yearSchema>;
export type createYearDTO = z.infer<typeof createYearSchema>;
export type updateYearDTO = z.infer<typeof updateYearSchema>;