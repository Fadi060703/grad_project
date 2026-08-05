import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { readFile } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";
import { z } from "zod";
import type { LectureType } from "../generated/prisma/enums";

const GEMINI_MODEL = "gemini-flash-latest";
const nonEmptyText = z.coerce.string().trim().min(1);
const textValue = z.coerce.string();

const flashcardSchema = z.object({
  question: nonEmptyText,
  answer: nonEmptyText,
});

const getNonEmptyString = (value: unknown) => {
  const text = value == null ? "" : String(value).trim();
  return text.length > 0 ? text : null;
};

const normalizeContentBlockInput = (value: unknown): unknown | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const block = value as Record<string, unknown>;
  const type = getNonEmptyString(block.type);
  const text = getNonEmptyString(block.text);
  const code = getNonEmptyString(block.code);
  const latex = getNonEmptyString(block.latex);

  if (type === "text") {
    return text ? { ...block, text } : null;
  }

  if (type === "list") {
    return Array.isArray(block.items) && block.items.length > 0
      ? block
      : text
        ? { type: "text", text }
        : null;
  }

  if (type === "formula") {
    return latex
      ? {
          ...block,
          latex,
          fallback_text:
            getNonEmptyString(block.fallback_text) ?? getNonEmptyString(block.caption) ?? undefined,
        }
      : text
        ? { type: "text", text }
        : null;
  }

  if (type === "code") {
    return code
      ? { ...block, code }
      : text
        ? { type: "text", text }
        : null;
  }

  if (type === "table") {
    return Array.isArray(block.headers) && Array.isArray(block.rows)
      ? block
      : text
        ? { type: "text", text }
        : null;
  }

  if (code) return { type: "code", code, language: block.language };
  if (latex) {
    return {
      type: "formula",
      latex,
      fallback_text:
        getNonEmptyString(block.fallback_text) ?? getNonEmptyString(block.caption) ?? undefined,
      caption: block.caption,
    };
  }
  if (Array.isArray(block.items) && block.items.length > 0) {
    return { type: "list", items: block.items };
  }
  if (Array.isArray(block.headers) && Array.isArray(block.rows)) {
    return { type: "table", headers: block.headers, rows: block.rows };
  }
  if (text) return { type: "text", text };

  return null;
};

const summaryContentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: nonEmptyText }),
  z.object({ type: z.literal("list"), items: z.array(nonEmptyText).min(1) }),
  z.object({
    type: z.literal("formula"),
    latex: nonEmptyText,
    fallback_text: nonEmptyText.nullish().transform((value) => value ?? undefined),
    caption: nonEmptyText.nullish().transform((value) => value ?? undefined),
  }),
  z.object({
    type: z.literal("code"),
    language: nonEmptyText.nullish().transform((value) => value ?? undefined),
    code: nonEmptyText,
  }),
  z.object({
    type: z.literal("table"),
    headers: z.array(textValue).min(1),
    rows: z.array(z.array(textValue)).min(1),
  }),
]);

const summarySchema = z.object({
  title: nonEmptyText,
  overview: nonEmptyText,
  sections: z
    .array(
      z.object({
        heading: nonEmptyText,
        page_reference: nonEmptyText.nullish().transform((value) => value ?? undefined),
        content: z
          .array(z.unknown())
          .transform((blocks) =>
            blocks
              .map(normalizeContentBlockInput)
              .filter((block): block is NonNullable<typeof block> => block !== null),
          )
          .pipe(z.array(summaryContentBlockSchema).min(1)),
      }),
    )
    .min(1),
  glossary: z
    .array(
      z.object({
        term: nonEmptyText,
        definition: nonEmptyText,
      }),
    )
    .default([]),
});

const generatedStudyMaterialsSchema = z.object({
  flashcards: z.array(flashcardSchema).min(10).max(25),
  summary: summarySchema,
});

const formatZodIssues = (err: z.ZodError) =>
  err.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

export type Flashcard = z.infer<typeof flashcardSchema>;
export type SummaryContentBlock = z.infer<typeof summaryContentBlockSchema>;
export type CourseFileSummaryData = z.infer<typeof summarySchema>;
export type GeneratedStudyMaterials = z.infer<typeof generatedStudyMaterialsSchema>;

export const parseStoredFlashcards = (value: unknown): Flashcard[] =>
  z.array(flashcardSchema).parse(value);

export const parseStoredSummary = (value: unknown): CourseFileSummaryData =>
  summarySchema.parse(value);

export class AiStudyMaterialGenerationError extends Error {
  debugDetails?: unknown;

  constructor(
    message: string,
    options?: { cause?: unknown; debugDetails?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AiStudyMaterialGenerationError";
    this.debugDetails = options?.debugDetails;
  }
}

export type GenerateCourseFileStudyMaterialsInput = {
  courseId: number;
  courseType: LectureType;
  title: string;
  file: string;
  mimeType: string;
  size: number;
};

const textSchema: Schema = { type: Type.STRING };

const contentBlockResponseSchema: Schema = {
  type: Type.OBJECT,
  description:
    "A summary content block. Set only the fields that match the chosen type.",
  properties: {
    type: {
      type: Type.STRING,
      format: "enum",
      enum: ["text", "list", "formula", "code", "table"],
    },
    text: textSchema,
    items: { type: Type.ARRAY, items: textSchema },
    latex: textSchema,
    fallback_text: textSchema,
    caption: textSchema,
    language: textSchema,
    code: textSchema,
    headers: { type: Type.ARRAY, items: textSchema },
    rows: {
      type: Type.ARRAY,
      items: { type: Type.ARRAY, items: textSchema },
    },
  },
  required: ["type"],
};

const generatedStudyMaterialsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    flashcards: {
      type: Type.ARRAY,
      minItems: "10",
      maxItems: "25",
      items: {
        type: Type.OBJECT,
        properties: {
          question: textSchema,
          answer: textSchema,
        },
        required: ["question", "answer"],
      },
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        title: textSchema,
        overview: textSchema,
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              heading: textSchema,
              page_reference: textSchema,
              content: {
                type: Type.ARRAY,
                items: contentBlockResponseSchema,
              },
            },
            required: ["heading", "content"],
          },
        },
        glossary: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: textSchema,
              definition: textSchema,
            },
            required: ["term", "definition"],
          },
        },
      },
      required: ["title", "overview", "sections", "glossary"],
    },
  },
  required: ["flashcards", "summary"],
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
    throw new AiStudyMaterialGenerationError("Invalid course file path");
  }

  return diskPath;
};

const buildPrompt = (input: GenerateCourseFileStudyMaterialsInput) => `
You are an expert university teaching assistant that turns lecture PDFs into structured study materials.
Analyze the attached PDF course file and produce flashcards plus structured study notes.

Course context:
- Course ID: ${input.courseId}
- Course file title: ${input.title}
- Course file type: ${input.courseType === "PRACTICAL" ? "practical" : "theoretical"}
- PDF size: ${input.size} bytes

Language requirements:
- Detect the main language of the PDF.
- Write all generated content in the same language as the PDF.
- If the PDF is mixed language, preserve that style naturally.

Global accuracy rules:
- Base everything only on the PDF content.
- Do not invent facts, examples, formulas, code, terminology, page references, or relationships.
- If something is ambiguous, cropped, or illegible, omit it instead of guessing.
- Preserve important technical terms exactly when needed, but explain them in student-friendly wording.
- Return only one JSON object matching the configured schema. No markdown fences. No commentary.

Flashcard rules:
- Generate between 10 and 25 flashcards depending on content depth. Never generate fewer than 10.
- Ask questions that test understanding, definitions, relationships, steps, formulas, code behavior, and common mistakes.
- Avoid trivial questions that only copy slide wording.
- Keep answers concise but complete enough for revision.

Summary rules:
1. Set "title" to the lecture subject/topic. Infer it from the PDF if it is not explicitly stated.
2. Set "overview" to a 2-3 sentence high-level explanation of what the entire lecture covers.
3. Identify the natural sections/topics of the lecture using headings, slide titles, or clear topic shifts.
   - Do not force artificial sections.
   - If the lecture is short or has one continuous topic, one section is acceptable.
4. For each section, set "heading" to a clear topic name and set "page_reference" using the page/slide numbers from the PDF, such as "pp. 3-5" or "Slide 12".
   - If page/slide numbers cannot be determined, omit "page_reference".
5. For explanatory material, use "text" or "list" blocks.
   - Rewrite concisely in your own words.
   - Do not copy long sentences verbatim from the PDF.
6. For mathematical content, use a "formula" block only when the formula appears or is clearly central in the PDF.
   - Put valid LaTeX in "latex".
   - Also provide "fallback_text" with a short plain-language explanation, for example: "the derivative of x squared is 2x".
7. For code, use a "code" block only when actual code appears in the PDF.
   - Preserve the code accurately and do not summarize it.
   - Set "language" when you can identify it, such as "python", "java", "c", "cpp", "javascript", or "sql".
8. For comparisons or tabular data, use a "table" block with clear headers and rows.
9. Populate "glossary" with important central terms introduced or explained in the lecture.
   - Use one-sentence definitions.
   - Do not pad with trivial, unrelated, or generic terms.
10. Use content block types only when they fit the source material. Do not create fake code, formulas, or tables.

Return exactly one JSON object matching this shape:
{
  "flashcards": [
    { "question": "...", "answer": "..." }
  ],
  "summary": {
    "title": "...",
    "overview": "...",
    "sections": [
      {
        "heading": "...",
        "page_reference": "pp. 1-3",
        "content": [
          { "type": "text", "text": "..." },
          { "type": "list", "items": ["...", "..."] },
          { "type": "formula", "latex": "...", "fallback_text": "..." },
          { "type": "code", "language": "python", "code": "..." },
          { "type": "table", "headers": ["..."], "rows": [["..."]] }
        ]
      }
    ],
    "glossary": [
      { "term": "...", "definition": "..." }
    ]
  }
}
`;

const parseGeminiJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
    throw new AiStudyMaterialGenerationError(
      "Gemini returned invalid JSON for the course file study materials",
    );
  }
};

export const generateCourseFileStudyMaterials = async (
  input: GenerateCourseFileStudyMaterialsInput,
): Promise<GeneratedStudyMaterials> => {
  if (input.mimeType.toLowerCase() !== "application/pdf") {
    throw new AiStudyMaterialGenerationError(
      "AI study material generation supports PDF course files only",
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiStudyMaterialGenerationError("Missing GEMINI_API_KEY env var");
  }

  try {
    const diskPath = resolvePublicFilePath(input.file);
    const pdfBuffer = await readFile(diskPath);
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildPrompt(input) },
            {
              inlineData: {
                mimeType: input.mimeType,
                data: pdfBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 12000,
        responseMimeType: "application/json",
        responseSchema: generatedStudyMaterialsResponseSchema,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new AiStudyMaterialGenerationError(
        "Gemini returned an empty response for the course file study materials",
      );
    }

    return generatedStudyMaterialsSchema.parse(parseGeminiJson(responseText));
  } catch (err) {
    if (err instanceof AiStudyMaterialGenerationError) {
      throw err;
    }

    if (err instanceof z.ZodError) {
      throw new AiStudyMaterialGenerationError(
        `Gemini returned study materials that do not match the expected structure: ${formatZodIssues(err)}`,
        { cause: err },
      );
    }

    throw new AiStudyMaterialGenerationError(
      "Failed to generate AI study materials for the course file",
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
