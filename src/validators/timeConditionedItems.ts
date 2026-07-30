import { z } from "zod";

export const timeConditionedItemTypeSchema = z.enum([
  "lecture",
  "practical_exam",
  "theoretical_exam",
]);

export const timeConditionedExamItemSchema = z.object({
  id: z.number(),
  type: z.enum(["THEORETICAL", "PRACTICAL"]),
  status: z.enum(["READY", "PUBLISHED"]),
  course_id: z.number(),
  course: z.object({
    id: z.number(),
    name: z.string(),
    code: z.string().nullable(),
    image: z.string().nullable(),
  }),
  setting: z.object({
    id: z.number(),
    exam_id: z.number(),
    date: z.union([z.date(), z.string()]),
    start_time: z.string(),
    end_time: z.string(),
    location: z
      .object({
        id: z.number(),
        name: z.string(),
        reaching_description: z.string().nullable(),
      })
      .nullable(),
  }),
});

export const nextTimeConditionedItemResponseSchema = z.object({
  item_type: timeConditionedItemTypeSchema,
  item: z.unknown().nullable(),
});

export const timeConditionedScheduleDaySchema = z
  .object({
    name: z.string(),
    date: z.union([z.date(), z.string()]),
  })
  .nullable();

export const timeConditionedItemsResponseSchema = z.object({
  item_type: timeConditionedItemTypeSchema,
  day: timeConditionedScheduleDaySchema.optional(),
  items: z.array(z.unknown()),
});

export type TimeConditionedItemType = z.infer<typeof timeConditionedItemTypeSchema>;
export type TimeConditionedExamItem = z.infer<typeof timeConditionedExamItemSchema>;
export type NextTimeConditionedItemResponse = z.infer<
  typeof nextTimeConditionedItemResponseSchema
>;
export type TimeConditionedItemsResponse = z.infer<
  typeof timeConditionedItemsResponseSchema
>;
