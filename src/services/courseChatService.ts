import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import type { CourseFileSummaryData } from "./aiStudyMaterialsService";

const GEMINI_MODEL = "gemini-flash-latest";

export class CourseChatError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CourseChatError";
  }
}

export type CourseChatSummaryInput = {
  courseFileId: number;
  title: string;
  courseType: string;
  summary: CourseFileSummaryData;
};

export type AskCourseChatInput = {
  question: string;
  summaries: CourseChatSummaryInput[];
  previousInteractionId?: string | null;
  shouldSendSummaries: boolean;
};

export type AskCourseChatResult = {
  answer: string;
  interactionId: string;
};

export const createSummariesHash = (summaries: CourseChatSummaryInput[]) =>
  createHash("sha256").update(JSON.stringify(summaries)).digest("hex");

const systemInstruction = `
You are a helpful course assistant for university students.
Answer only using the course summaries that were provided in this chat context.
If the answer is not found in the provided course content, say: "I could not find this in the course materials."
Keep answers concise and directly enough for the student's question.
Use the same language as the student's question and the course materials when possible.
Do not invent external facts, sources, page references, examples, or requirements.
Do not mention internal JSON or implementation details.
`;

const buildInitialInput = (summaries: CourseChatSummaryInput[], question: string) => `
Course summaries JSON:
${JSON.stringify(summaries)}

Student question:
${question}
`;

export const askCourseChat = async (
  input: AskCourseChatInput,
): Promise<AskCourseChatResult> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new CourseChatError("Missing GEMINI_API_KEY env var");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: GEMINI_MODEL,
      system_instruction: systemInstruction,
      previous_interaction_id: input.previousInteractionId ?? undefined,
      input: input.shouldSendSummaries
        ? buildInitialInput(input.summaries, input.question)
        : input.question,
      generation_config: {
        max_output_tokens: 900,
      },
    });

    const answer = interaction.output_text?.trim();
    const interactionId = interaction.id;

    if (!answer || !interactionId) {
      throw new CourseChatError("Gemini returned an empty course chat response");
    }

    return { answer, interactionId };
  } catch (err) {
    if (err instanceof CourseChatError) {
      throw err;
    }

    throw new CourseChatError("Failed to generate course chat answer", {
      cause: err,
    });
  }
};
