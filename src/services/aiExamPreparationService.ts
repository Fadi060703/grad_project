import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { CourseFileSummaryData } from "./aiStudyMaterialsService";

const GEMINI_MODEL = "gemini-flash-latest";
const optionIds = ["A", "B", "C", "D"] as const;

const examOptionSchema = z.object({
  id: z.enum(optionIds),
  text: z.coerce.string().trim().min(1),
});

const examQuestionSchema = z.object({
  question: z.coerce.string().trim().min(1),
  options: z
    .array(examOptionSchema)
    .length(4)
    .refine(
      (options) => new Set(options.map((option) => option.id)).size === 4,
      "Options must have unique IDs A, B, C, and D",
    ),
  correct_option_id: z.enum(optionIds),
  explanation: z.coerce.string().trim().min(1),
  page_reference: z.coerce
    .string()
    .trim()
    .min(1)
    .nullish()
    .transform((value) => value ?? undefined),
});

const examPreparationSchema = z.object({
  title: z.coerce.string().trim().min(1),
  overview: z.coerce.string().trim().min(1),
  questions: z.array(examQuestionSchema).min(1).max(60),
});

export type ExamPreparation = z.infer<typeof examPreparationSchema>;

export class AiExamPreparationError extends Error {
  debugDetails?: unknown;

  constructor(
    message: string,
    options?: { cause?: unknown; debugDetails?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AiExamPreparationError";
    this.debugDetails = options?.debugDetails;
  }
}

export type ExamPreparationSummaryInput = {
  courseFileId: number;
  title: string;
  courseType: string;
  summary: CourseFileSummaryData;
};

export type GenerateExamPreparationInput = {
  questionCount: number;
  summaries: ExamPreparationSummaryInput[];
};



const formatZodIssues = (err: z.ZodError) =>
  err.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

const parseGeminiJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
    throw new AiExamPreparationError(
      "Gemini returned invalid JSON for the exam preparation",
    );
  }
};

const buildPrompt = (input: GenerateExamPreparationInput) => `
You are an expert university teaching assistant creating a practice exam for students.
You will receive structured summaries extracted from one or more course files.
Generate a multiple-choice practice test based only on those summaries.

Language requirements:
- Use the same language as the provided summaries/course materials.
- If the summaries are mixed language, preserve that style naturally.

Accuracy and quality rules:
- Base every question only on the provided summaries.
- Do not invent facts, topics, formulas, or terminology not present in the summaries.
- Prefer useful exam-preparation questions that test understanding, relationships, definitions, procedures, formulas, code behavior, and common mistakes.
- Avoid trivial wording questions.
- Generate up to ${input.questionCount} questions.
- If the summaries do not contain enough material for ${input.questionCount} good questions, generate fewer questions rather than padding with weak or invented questions.
- Every question must have exactly 4 options: A, B, C, and D.
- Every question must have exactly one correct option.
- Randomize the correct option position naturally across A, B, C, and D.
- Do not overuse any one correct option letter. Avoid making B the most common correct answer.
- Do not make the correct option consistently longer, more detailed, or more specific than the distractors.
- Keep all four options similar in length, grammar, specificity, and style.
- Avoid obvious patterns like "all of the above", "none of the above", always-longest-is-correct, or repeated phrasing.
- Distractors must be plausible but clearly incorrect based on the summaries.
- Provide a concise explanation that tells the student why the correct option is correct.
- Add "page_reference" to each question using the most relevant page/slide reference from the summaries, such as "pp. 3-5" or "Slide 12". If no source page/slide is available, omit "page_reference".
- Return only one JSON object matching the configured schema. No markdown fences. No commentary.

Required JSON shape:
{
  "title": "Practice Exam: ...",
  "overview": "Short 1-2 sentence description of what this practice exam covers.",
  "questions": [
    {
      "question": "...",
      "options": [
        { "id": "A", "text": "..." },
        { "id": "B", "text": "..." },
        { "id": "C", "text": "..." },
        { "id": "D", "text": "..." }
      ],
      "correct_option_id": "A",
      "explanation": "...",
      "page_reference": "pp. 3-5"
    }
  ]
}

Summaries JSON:
${JSON.stringify(input.summaries)}
`;

export const generateExamPreparation = async (
  input: GenerateExamPreparationInput,
): Promise<ExamPreparation> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiExamPreparationError("Missing GEMINI_API_KEY env var");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(input),
      config: {
        temperature: 0.25,
        maxOutputTokens: 12000,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new AiExamPreparationError(
        "Gemini returned an empty response for the exam preparation",
      );
    }

    return examPreparationSchema.parse(parseGeminiJson(responseText));
  } catch (err) {
    if (err instanceof AiExamPreparationError) {
      throw err;
    }

    if (err instanceof z.ZodError) {
      throw new AiExamPreparationError(
        `Gemini returned exam preparation data that does not match the expected structure: ${formatZodIssues(err)}`,
        { cause: err },
      );
    }

    throw new AiExamPreparationError(
      "Failed to generate AI exam preparation",
      {
        cause: err,
        debugDetails:
          err instanceof Error
            ? {
                name: err.name,
                message: err.message,
                stack: err.stack,
              }
            : err,
      },
    );
  }
};
