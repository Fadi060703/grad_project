import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-flash-latest";

export class AiSurveyInsightsError extends Error {
  debugDetails?: unknown;

  constructor(
    message: string,
    options?: { cause?: unknown; debugDetails?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AiSurveyInsightsError";
    this.debugDetails = options?.debugDetails;
  }
}

export type GenerateSurveyInsightsInput = {
  survey: {
    id: number;
    title: string;
    description: string | null;
    year: { id: number; name: string } | null;
    summary: unknown;
  };
};

const buildPrompt = (input: GenerateSurveyInsightsInput) => `
أنت محلل أكاديمي خبير في تحليل نتائج استبيانات الطلاب داخل كلية جامعية.
سيتم تزويدك بملخص استبيان يحتوي على الأسئلة، الخيارات، عدد من اختار كل خيار، والنسب المئوية.

المطلوب:
- اكتب التحليل باللغة العربية فقط.
- قدّم ملخصاً تنفيذياً قصيراً لنتائج الاستبيان.
- استخرج أهم الأنماط والملاحظات من النسب والأعداد.
- اذكر نقاط القوة أو الرضا إن وجدت.
- اذكر المشاكل أو مؤشرات القلق إن وجدت.
- اقترح توصيات عملية قابلة للتنفيذ للإدارة أو الكادر الأكاديمي.
- لا تخترع معلومات غير موجودة في الملخص.
- إذا كانت الإجابات قليلة، وضّح أن الاستنتاجات محدودة بسبب حجم العينة.
- أعد نصاً فقط، بدون JSON وبدون Markdown.

بيانات الاستبيان:
${JSON.stringify(input.survey)}
`;

export const generateSurveyInsights = async (
  input: GenerateSurveyInsightsInput,
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiSurveyInsightsError("Missing GEMINI_API_KEY env var");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(input),
      config: {
        temperature: 0.2,
        maxOutputTokens: 3000,
      },
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      throw new AiSurveyInsightsError(
        "Gemini returned an empty response for the survey insights",
      );
    }

    return responseText;
  } catch (err) {
    if (err instanceof AiSurveyInsightsError) {
      throw err;
    }

    throw new AiSurveyInsightsError("Failed to generate survey insights", {
      cause: err,
      debugDetails:
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack,
            }
          : err,
    });
  }
};
