import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { createListHandler } from "../lib/express-prisma-query";
import { prisma } from "../lib/prisma";
import { notifyStudentsSafely } from "../services";
import { generateSurveyInsights } from "../services/aiSurveyInsightsService";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createSurveySchema,
  studentSurveyResponseSchema,
  submitSurveyAnswerSchema,
  surveyIdParamsSchema,
  surveyMetadataResponseSchema,
  surveyQuestionSchema,
  surveyResponseSchema,
  surveySummaryResponseSchema,
  updateSurveySchema,
  type SurveyAnswerInput,
  type SurveyQuestion,
  type SurveyQuestionSummary,
} from "../validators/surveys";

const DEFAULT_NOTIFICATION_ICON = "/logo_light_mode.svg";

const surveySelect = {
  id: true,
  year_id: true,
  year: { select: { id: true, name: true } },
  title: true,
  description: true,
  questions: true,
  status: true,
  summary: true,
  ai_insights: true,
  created_at: true,
  updated_at: true,
} as const;

const surveyMetadataSelect = {
  id: true,
  year_id: true,
  year: { select: { id: true, name: true } },
  title: true,
  description: true,
  status: true,
  created_at: true,
  updated_at: true,
} as const;

const makeId = (prefix: string) => `${prefix}_${randomUUID()}`;

const normalizeQuestions = (
  questions: z.infer<typeof createSurveySchema>["questions"],
): SurveyQuestion[] =>
  questions.map((question) => ({
    id: makeId("q"),
    question: question.question,
    options: question.options.map((option) => ({
      id: makeId("opt"),
      text: option.text,
    })),
  }));

const normalizeDescription = (description: string | null | undefined) => {
  if (description === undefined || description === null) return null;
  return description.length > 0 ? description : null;
};

const parseSurveyQuestions = (questions: unknown): SurveyQuestion[] =>
  z.array(surveyQuestionSchema).parse(questions);

const ensureYearExists = async (yearId: number | null | undefined) => {
  if (yearId === null || yearId === undefined) return;

  const year = await prisma.year.findUnique({
    where: { id: yearId },
    select: { id: true },
  });

  if (!year) {
    throw new NotFoundError("Year");
  }
};

const getStudentFromRequest = async (req: Request) => {
  const { id: userId, role } = req.user as { id: number; role: string };

  if (role !== "STUDENT") {
    throw new ForbiddenError("Only students can access this endpoint");
  }

  const student = await prisma.student.findUnique({
    where: { userId },
    select: { student_id: true, year_id: true },
  });

  if (!student) {
    throw new ForbiddenError("Student profile not found");
  }

  return student;
};

const isSurveyRelatedToStudent = (
  survey: { year_id: number | null },
  student: { year_id: number },
) => survey.year_id === null || survey.year_id === student.year_id;

const getSurveyRecipientStudentIds = async (yearId: number | null) => {
  const students = await prisma.student.findMany({
    where: yearId === null ? {} : { year_id: yearId },
    select: { student_id: true },
  });

  return students.map((student) => student.student_id);
};

const roundPercentage = (value: number) => Math.round(value * 100) / 100;

const buildSurveySummary = (
  questions: SurveyQuestion[],
  submittedAnswers: { answers: unknown }[],
): SurveyQuestionSummary[] => {
  const summaryByQuestionId = new Map(
    questions.map((question) => [
      question.id,
      {
        question_id: question.id,
        question: question.question,
        total_answers: 0,
        options: question.options.map((option) => ({
          option_id: option.id,
          text: option.text,
          count: 0,
          percentage: 0,
        })),
      },
    ]),
  );

  for (const row of submittedAnswers) {
    const parsed = submitSurveyAnswerSchema.parse({ answers: row.answers });

    for (const answer of parsed.answers) {
      const questionSummary = summaryByQuestionId.get(answer.question_id);
      if (!questionSummary) continue;

      const optionSummary = questionSummary.options.find(
        (option) => option.option_id === answer.selected_option_id,
      );
      if (!optionSummary) continue;

      questionSummary.total_answers += 1;
      optionSummary.count += 1;
    }
  }

  return [...summaryByQuestionId.values()].map((questionSummary) => ({
    ...questionSummary,
    options: questionSummary.options.map((option) => ({
      ...option,
      percentage:
        questionSummary.total_answers === 0
          ? 0
          : roundPercentage((option.count / questionSummary.total_answers) * 100),
    })),
  }));
};

const validateCompleteAnswers = (
  questions: SurveyQuestion[],
  answers: SurveyAnswerInput[],
) => {
  const expectedQuestionIds = new Set(questions.map((question) => question.id));
  const answerQuestionIds = new Set(answers.map((answer) => answer.question_id));

  if (answerQuestionIds.size !== answers.length) {
    throw new BadRequestError("Duplicate answers for the same question are not allowed");
  }

  if (answerQuestionIds.size !== expectedQuestionIds.size) {
    throw new BadRequestError("All survey questions must be answered");
  }

  for (const question of questions) {
    const answer = answers.find((item) => item.question_id === question.id);
    if (!answer) {
      throw new BadRequestError("All survey questions must be answered");
    }

    const selectedOptionExists = question.options.some(
      (option) => option.id === answer.selected_option_id,
    );

    if (!selectedOptionExists) {
      throw new BadRequestError(
        `Invalid selected option for question ${question.id}`,
      );
    }
  }
};

export const getAllSurveys = createListHandler({
  prisma: prisma.survey,
  allowedSortFields: ["id", "title", "status", "year_id", "created_at", "updated_at"],
  fieldTypes: {
    id: "number",
    title: "text",
    description: "text",
    status: "text",
    year_id: "number",
    created_at: "date",
    updated_at: "date",
  },
  searchableFields: ["title", "description"],
  findManyArgs: {
    select: surveySelect,
  } as any,
  mapResult: ({ data }) => z.array(surveyResponseSchema).parse(data),
});

export const createSurvey = asyncHandler(async (req: Request, res: Response) => {
  const data = createSurveySchema.parse(req.body);

  await ensureYearExists(data.year_id);

  const created = await prisma.survey.create({
    data: {
      year_id: data.year_id ?? null,
      title: data.title,
      description: normalizeDescription(data.description),
      questions: normalizeQuestions(data.questions),
    },
    select: surveySelect,
  });

  return res.status(201).json({
    success: true,
    message: "Survey created successfully",
    data: surveyResponseSchema.parse(created),
  });
});

export const updateSurvey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = surveyIdParamsSchema.parse(req.params);
  const data = updateSurveySchema.parse(req.body);

  const existingSurvey = await prisma.survey.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existingSurvey) {
    throw new NotFoundError("Survey");
  }

  if (existingSurvey.status !== "DRAFT") {
    throw new BadRequestError("Survey cannot be updated after publishing");
  }

  await ensureYearExists(data.year_id);

  const updated = await prisma.survey.update({
    where: { id },
    data: {
      ...(data.year_id !== undefined ? { year_id: data.year_id } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: normalizeDescription(data.description) }
        : {}),
      ...(data.questions !== undefined
        ? { questions: normalizeQuestions(data.questions) }
        : {}),
    },
    select: surveySelect,
  });

  return res.status(200).json({
    success: true,
    message: "Survey updated successfully",
    data: surveyResponseSchema.parse(updated),
  });
});

export const deleteSurvey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = surveyIdParamsSchema.parse(req.params);

  const existingSurvey = await prisma.survey.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingSurvey) {
    throw new NotFoundError("Survey");
  }

  const deleted = await prisma.survey.delete({
    where: { id },
    select: surveySelect,
  });

  return res.status(200).json({
    success: true,
    message: "Survey deleted successfully",
    data: surveyResponseSchema.parse(deleted),
  });
});

export const publishSurvey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = surveyIdParamsSchema.parse(req.params);

  const survey = await prisma.survey.findUnique({
    where: { id },
    select: { id: true, title: true, year_id: true, status: true },
  });

  if (!survey) {
    throw new NotFoundError("Survey");
  }

  if (survey.status !== "DRAFT") {
    throw new BadRequestError("Only draft surveys can be published");
  }

  const updated = await prisma.survey.update({
    where: { id },
    data: { status: "PUBLISHED" },
    select: surveySelect,
  });

  const recipientStudentIds = await getSurveyRecipientStudentIds(survey.year_id);
  const notificationResult = await notifyStudentsSafely(
    recipientStudentIds,
    {
      title: "استبيان جديد متاح",
      body: `يرجى إكمال الاستبيان: ${survey.title}`,
      route: `/website/surveys/${survey.id}`,
      icon: DEFAULT_NOTIFICATION_ICON,
    },
    `survey ${survey.id}`,
  );

  return res.status(200).json({
    success: true,
    message: "Survey published successfully",
    data: surveyResponseSchema.parse(updated),
    notification: notificationResult,
  });
});

export const completeSurvey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = surveyIdParamsSchema.parse(req.params);

  const survey = await prisma.survey.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      questions: true,
    },
  });

  if (!survey) {
    throw new NotFoundError("Survey");
  }

  if (survey.status !== "PUBLISHED") {
    throw new BadRequestError("Only published surveys can be completed");
  }

  const questions = parseSurveyQuestions(survey.questions);
  const submittedAnswers = await prisma.surveyAnswer.findMany({
    where: { survey_id: id },
    select: { answers: true },
  });
  const summary = buildSurveySummary(questions, submittedAnswers);

  const updated = await prisma.survey.update({
    where: { id },
    data: { status: "COMPLETED", summary },
    select: surveySelect,
  });

  return res.status(200).json({
    success: true,
    message: "Survey completed successfully",
    data: surveyResponseSchema.parse(updated),
  });
});

export const generateSurveyAiInsights = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = surveyIdParamsSchema.parse(req.params);

    const survey = await prisma.survey.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        summary: true,
        year: { select: { id: true, name: true } },
      },
    });

    if (!survey) {
      throw new NotFoundError("Survey");
    }

    if (survey.status !== "COMPLETED") {
      throw new BadRequestError("AI insights can only be generated for completed surveys");
    }

    if (!survey.summary) {
      throw new BadRequestError("Survey summary is required before generating AI insights");
    }

    const aiInsights = await generateSurveyInsights({
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        year: survey.year,
        summary: survey.summary,
      },
    });

    const updated = await prisma.survey.update({
      where: { id },
      data: { ai_insights: aiInsights },
      select: {
        id: true,
        status: true,
        summary: true,
        ai_insights: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Survey AI insights generated successfully",
      data: surveySummaryResponseSchema.parse(updated),
    });
  },
);

export const getSurveySummary = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = surveyIdParamsSchema.parse(req.params);

    const survey = await prisma.survey.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        summary: true,
        ai_insights: true,
      },
    });

    if (!survey) {
      throw new NotFoundError("Survey");
    }

    return res.status(200).json({
      success: true,
      data: surveySummaryResponseSchema.parse(survey),
    });
  },
);

export const getMyStudentSurveys = createListHandler({
  prisma: prisma.survey,
  allowedSortFields: ["id", "title", "year_id", "created_at", "updated_at"],
  fieldTypes: {
    id: "number",
    title: "text",
    description: "text",
    year_id: "number",
    created_at: "date",
    updated_at: "date",
  },
  searchableFields: ["title", "description"],
  findManyArgs: {
    select: surveyMetadataSelect,
  } as any,
  handleFindArgs: async ({ req, findManyArgs }) => {
    const student = await getStudentFromRequest(req);

    return {
      ...findManyArgs,
      where: {
        AND: [
          findManyArgs.where,
          { status: "PUBLISHED" },
          { OR: [{ year_id: null }, { year_id: student.year_id }] },
          { answers: { none: { student_id: student.student_id } } },
        ],
      },
      orderBy: findManyArgs.orderBy ?? { created_at: "desc" },
    };
  },
  mapResult: ({ data }) => z.array(surveyMetadataResponseSchema).parse(data),
});

export const getStudentSurveyById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = surveyIdParamsSchema.parse(req.params);
    const student = await getStudentFromRequest(req);

    const survey = await prisma.survey.findUnique({
      where: { id },
      select: {
        ...surveySelect,
        answers: {
          where: { student_id: student.student_id },
          select: { id: true },
        },
      },
    });

    if (!survey) {
      throw new NotFoundError("Survey");
    }

    if (survey.status !== "PUBLISHED") {
      throw new NotFoundError("Survey");
    }

    if (!isSurveyRelatedToStudent(survey, student)) {
      throw new NotFoundError("Survey");
    }

    const { answers, ...surveyData } = survey;

    return res.status(200).json({
      success: true,
      data: studentSurveyResponseSchema.parse({
        ...surveyData,
        has_answered: answers.length > 0,
      }),
    });
  },
);

export const submitSurveyAnswer = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = surveyIdParamsSchema.parse(req.params);
    const student = await getStudentFromRequest(req);
    const data = submitSurveyAnswerSchema.parse(req.body);

    const survey = await prisma.survey.findUnique({
      where: { id },
      select: {
        id: true,
        year_id: true,
        status: true,
        questions: true,
      },
    });

    if (!survey) {
      throw new NotFoundError("Survey");
    }

    if (survey.status !== "PUBLISHED") {
      throw new BadRequestError("Survey is not accepting answers");
    }

    if (!isSurveyRelatedToStudent(survey, student)) {
      throw new NotFoundError("Survey");
    }

    const questions = parseSurveyQuestions(survey.questions);
    validateCompleteAnswers(questions, data.answers);

    const existingAnswer = await prisma.surveyAnswer.findUnique({
      where: {
        survey_id_student_id: {
          survey_id: id,
          student_id: student.student_id,
        },
      },
      select: { id: true },
    });

    if (existingAnswer) {
      throw new ConflictError("Student already answered this survey");
    }

    try {
      const created = await prisma.surveyAnswer.create({
        data: {
          survey_id: id,
          student_id: student.student_id,
          answers: data.answers,
        },
        select: {
          id: true,
          survey_id: true,
          student_id: true,
          answers: true,
          created_at: true,
          updated_at: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Survey answer submitted successfully",
        data: created,
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictError("Student already answered this survey");
      }
      throw err;
    }
  },
);
