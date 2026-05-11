// validators/groups.ts

import { z } from "zod";

export const getGroupsSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  section_id: z.number().positive().nullable(),
  section: z
    .object({
      id: z.number().positive(),
      name: z.string(),
      year_id: z.number().positive(),
      year: z
        .object({
          id: z.number().positive(),
          name: z.string(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  major_id: z.number().positive().nullable().optional(),
  major: z
    .object({
      id: z.number().positive(),
      name: z.string(),
      year_id: z.number().positive(),
      year: z
        .object({
          id: z.number().positive(),
          name: z.string(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),
  section_id: z.number().optional(),
  major_id: z.number().optional(),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .optional(),
  section_id: z.number().optional(),
  major_id: z.number().optional(),
});

// Export types
export type createGroupDTO = z.infer<typeof createGroupSchema>;
export type getGroupsDTO = z.infer<typeof getGroupsSchema>;
export type updateGroupDTO = z.infer<typeof updateGroupSchema>;
