import { z } from "zod";

export const sortSchema = z.object({
  id: z.string().min(1),
  desc: z.coerce.boolean().default(false),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pagesize: z.coerce.number().int().positive().max(500).default(10),
  filters: z.any().optional().default([]),
  sort: z.any().optional().default([]),
  search: z.string().optional(),
  joinOperator: z.enum(["and", "or"]).optional().default("and"),
});

export type QueryParams = z.infer<typeof paginationSchema>;

