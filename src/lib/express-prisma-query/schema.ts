import { z } from "zod";

export const filterSchema = z.object({
  // Allow dots for nested paths (e.g. driver.status) and [] for list relations (e.g. orders[].status)
  id: z.string().regex(/^[a-zA-Z0-9_.\[\]]+$/),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
    z.array(z.boolean()),
  ]),
  type: z.enum(["text", "number", "boolean", "date"]),
  operator: z.enum([
    "eq",
    "ne",
    "iLike",
    "notILike",
    "contains",
    "gt",
    "lt",
    "gte",
    "lte",
    "isBetween",
    "isEmpty",
    "isNotEmpty",
  ]),
  relationOperator: z.enum(["every", "some", "none"]).optional(),
});

export type Filter = z.infer<typeof filterSchema>;

