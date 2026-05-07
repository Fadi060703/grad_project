import { z } from "zod";
import { getSectionsSchema } from "./sections";

export const yearSchema = z.object({
  id: z.number(),
  name: z.string(),
  sections: z.array(getSectionsSchema).optional(), // Made optional to match frontend
  majors: z.array(z.any()).optional(), // Added to match frontend Year interface
});

export const createYearSchema = z.object({
  name: z.string(),
});

export const updateYearSchema = z.object({
  name: z.string(),
});

// Export types
export type yearDTO = z.infer<typeof yearSchema>;
export type createYearDTO = z.infer<typeof createYearSchema>;
export type updateYearDTO = z.infer<typeof updateYearSchema>;