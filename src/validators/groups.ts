// validators/groups.ts

import { z } from 'zod';

export const getGroupsSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  sectionId: z.number().positive(),
  section: z.object({
    id: z.number().positive(),
    name: z.string(),
    yearId: z.number().positive(),
    year: z.object({
      id: z.number().positive(),
      name: z.string()
    }).optional()
  }).optional(),
  majorId: z.number().positive().optional(),
  major: z.object({
    id: z.number().positive(),
    name: z.string(),
    yearId: z.number().positive(),
    year: z.object({
      id: z.number().positive(),
      name: z.string()
    }).optional()
  }).optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

export const createGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters"),
  section_id: z.number().positive("Section ID must be a positive number"),
  major_id: z.number().positive("Major ID must be a positive number").optional()
});

export const updateGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters").optional(),
  section_id: z.number().positive("Section ID must be a positive number").optional(),
  major_id: z.number().positive("Major ID must be a positive number").optional()
});

// Export types
export type createGroupDTO = z.infer<typeof createGroupSchema>;
export type getGroupsDTO = z.infer<typeof getGroupsSchema>;
export type updateGroupDTO = z.infer<typeof updateGroupSchema>;