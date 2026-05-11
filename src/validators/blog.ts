// validators/blog.ts

import { z } from "zod";

export const getBlogsSchema = z.object({
  id: z.number().positive(),
  title: z.string(),
  content: z.string(),
  image: z.string().optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const createBlogSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters"),
  content: z
    .string()
    .min(3, "Content must be at least 3 characters")
    .max(20000, "Content must not exceed 20000 characters"),
  image: z.string().optional().nullable(),
});

export const updateBlogSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters")
    .optional(),
  content: z
    .string()
    .min(3, "Content must be at least 3 characters")
    .max(20000, "Content must not exceed 20000 characters")
    .optional(),
  image: z.string().optional().nullable(),
});

// Export types
export type getBlogDTO = z.infer<typeof getBlogsSchema>;
export type createBlogDTO = z.infer<typeof createBlogSchema>;
export type updateBlogDTO = z.infer<typeof updateBlogSchema>;
