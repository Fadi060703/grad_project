import { z } from "zod";

const dateFieldSchema = z.union([z.string().datetime(), z.date()]).optional();

export const surveyStatusSchema = z.enum(["DRAFT", "PUBLISHED", "COMPLETED"]);

export const surveyOptionInputSchema = z.object({
  text: z.coerce.string().trim().min(1, "Option text is required"),
});

export const surveyQuestionInputSchema = z.object({
  question: z.coerce.string().trim().min(1, "Question text is required"),
  options: z
    .array(surveyOptionInputSchema)
    .min(2, "Each question must have at least 2 options"),
});

export const createSurveySchema = z.object({
  year_id: z.number().int().positive().optional().nullable(),
  title: z.coerce
    .string()
    .trim()
    .min(1, "Title is required")
    .max(255, "Title must not exceed 255 characters"),
  description: z.coerce.string().trim().optional().nullable(),
  questions: z
    .array(surveyQuestionInputSchema)
    .min(1, "Survey must have at least 1 question"),
});

export const updateSurveySchema = z.object({
  year_id: z.number().int().positive().optional().nullable(),
  title: z.coerce
    .string()
    .trim()
    .min(1, "Title is required")
    .max(255, "Title must not exceed 255 characters")
    .optional(),
  description: z.coerce.string().trim().optional().nullable(),
  questions: z
    .array(surveyQuestionInputSchema)
    .min(1, "Survey must have at least 1 question")
    .optional(),
});

export const surveyIdParamsSchema = z.object({
  id: z.coerce.number().int().positive("Invalid survey ID"),
});

export const surveyOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const surveyQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(surveyOptionSchema).min(2),
});

export const submitSurveyAnswerSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().min(1, "Question ID is required"),
        selected_option_id: z.string().min(1, "Selected option ID is required"),
      }),
    )
    .min(1, "Answers are required"),
});

export const surveySummaryOptionSchema = z.object({
  option_id: z.string().min(1),
  text: z.string().min(1),
  count: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
});

export const surveyQuestionSummarySchema = z.object({
  question_id: z.string().min(1),
  question: z.string().min(1),
  total_answers: z.number().int().nonnegative(),
  options: z.array(surveySummaryOptionSchema),
});

export const surveyYearSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
  })
  .nullable()
  .optional();

export const surveyResponseSchema = z.object({
  id: z.number().int().positive(),
  year_id: z.number().int().positive().nullable(),
  year: surveyYearSchema,
  title: z.string(),
  description: z.string().nullable(),
  questions: z.array(surveyQuestionSchema),
  status: surveyStatusSchema,
  summary: z.array(surveyQuestionSummarySchema).nullable().optional(),
  ai_insights: z.string().nullable().optional(),
  created_at: dateFieldSchema,
  updated_at: dateFieldSchema,
});

export const surveyMetadataResponseSchema = surveyResponseSchema.omit({
  questions: true,
  summary: true,
  ai_insights: true,
});

export const studentSurveyResponseSchema = surveyResponseSchema
  .omit({
    summary: true,
    ai_insights: true,
  })
  .extend({
    has_answered: z.boolean().optional(),
  });

export const surveySummaryResponseSchema = z.object({
  id: z.number().int().positive(),
  status: surveyStatusSchema,
  summary: z.array(surveyQuestionSummarySchema).nullable(),
  ai_insights: z.string().nullable(),
});

export type CreateSurveyDTO = z.infer<typeof createSurveySchema>;
export type UpdateSurveyDTO = z.infer<typeof updateSurveySchema>;
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;
export type SurveyAnswerInput = z.infer<typeof submitSurveyAnswerSchema>["answers"][number];
export type SurveyQuestionSummary = z.infer<typeof surveyQuestionSummarySchema>;
