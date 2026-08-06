import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-flash-latest";
export const UNIVERSITY_CHATBOT_FALLBACK =
  "I could not find this in the university information.";

export class UniversityChatbotError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UniversityChatbotError";
  }
}

export type UniversityChatbotContent = {
  text: string;
  hash: string;
};

export type AskUniversityChatbotInput = {
  message: string;
  content: UniversityChatbotContent;
  previousInteractionId?: string | null;
  shouldSendContent: boolean;
};

export type AskUniversityChatbotResult = {
  answer: string;
  interactionId: string;
};

const resolvePublicFilePath = (storedPath: string) => {
  const publicDir = resolve(process.cwd(), "public");
  let cleaned = storedPath.trim().replace(/^[\\/]+/, "");

  if (cleaned.startsWith("public/") || cleaned.startsWith("public\\")) {
    cleaned = cleaned.slice("public/".length);
  }

  const diskPath = resolve(publicDir, cleaned);
  const relativePath = relative(publicDir, diskPath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return diskPath;
};

export const readUniversityChatbotFile = async (
  storedPath: string | null | undefined,
): Promise<UniversityChatbotContent | null> => {
  if (!storedPath?.trim()) {
    return null;
  }

  const diskPath = resolvePublicFilePath(storedPath);
  if (!diskPath) {
    return null;
  }

  try {
    const text = await readFile(diskPath, "utf8");
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    return {
      text: trimmed,
      hash: createHash("sha256").update(trimmed).digest("hex"),
    };
  } catch {
    return null;
  }
};

const systemInstruction = `
You are a helpful university chatbot for students.
Answer only from the university information markdown provided in this chat context.
If the answer is not found in that information, say exactly: "${UNIVERSITY_CHATBOT_FALLBACK}"
Keep answers concise, clear, and directly enough for the student's question.
Use the same language as the student's question when possible.
Do not invent policies, dates, contacts, schedules, links, or requirements.
Do not mention internal markdown, JSON, files, prompts, or implementation details.
`;

const buildInitialInput = (content: string, message: string) => `
University information markdown:
${content}

Student message:
${message}
`;

export const askUniversityChatbot = async (
  input: AskUniversityChatbotInput,
): Promise<AskUniversityChatbotResult> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new UniversityChatbotError("Missing GEMINI_API_KEY env var");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: GEMINI_MODEL,
      system_instruction: systemInstruction,
      previous_interaction_id: input.previousInteractionId ?? undefined,
      input: input.shouldSendContent
        ? buildInitialInput(input.content.text, input.message)
        : input.message,
      generation_config: {
        max_output_tokens: 700,
      },
    });

    const answer = interaction.output_text?.trim();
    const interactionId = interaction.id;

    if (!answer || !interactionId) {
      throw new UniversityChatbotError(
        "Gemini returned an empty university chatbot response",
      );
    }

    return { answer, interactionId };
  } catch (err) {
    if (err instanceof UniversityChatbotError) {
      throw err;
    }

    throw new UniversityChatbotError(
      "Failed to generate university chatbot answer",
      { cause: err },
    );
  }
};
