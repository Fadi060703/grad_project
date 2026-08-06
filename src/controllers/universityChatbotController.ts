import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import {
  askUniversityChatbot,
  readUniversityChatbotFile,
  UNIVERSITY_CHATBOT_FALLBACK,
  UniversityChatbotError,
} from "../services/universityChatbotService";

const chatbotRequestSchema = z.object({
  message: z.string().trim().min(1).max(3000),
});

const getAuthStudent = async (req: Request) => {
  const { id, role } = req.user as { id: number | string; role: string };
  const userId = Number(id);

  if (role !== "STUDENT" || !Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return prisma.student.findUnique({
    where: { userId },
    select: { student_id: true },
  });
};

const getChatbotFilePath = async () => {
  const faculityInfo = await prisma.faculityInfo.findFirst({
    select: { uni_chatbot_file: true },
  });

  return faculityInfo?.uni_chatbot_file ?? null;
};

export const getUniversityChatbotMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const student = await getAuthStudent(req);
    if (!student) {
      return res.status(403).json({ error: "Only students can access chatbot" });
    }

    const session = await prisma.chatbotSession.findUnique({
      where: { student_id: student.student_id },
      select: {
        id: true,
        content_hash: true,
        messages: {
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
          select: {
            id: true,
            sender: true,
            content: true,
            created_at: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(200).json({ session_id: null, messages: [] });
    }

    return res.status(200).json({
      session_id: session.id,
      content_hash: session.content_hash,
      messages: session.messages,
    });
  },
);

export const universityChatbot = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const student = await getAuthStudent(req);
      if (!student) {
        return res.status(403).json({ error: "Only students can access chatbot" });
      }

      const data = chatbotRequestSchema.parse(req.body);
      const existingSession = await prisma.chatbotSession.findUnique({
        where: { student_id: student.student_id },
        select: {
          id: true,
          previous_interaction_id: true,
          content_hash: true,
        },
      });

      const chatbotFilePath = await getChatbotFilePath();
      const chatbotContent = await readUniversityChatbotFile(chatbotFilePath);
      const isNewSession = !existingSession;

      let answer = UNIVERSITY_CHATBOT_FALLBACK;
      let interactionId = existingSession?.previous_interaction_id ?? null;
      let contextRefreshed = false;

      if (chatbotContent) {
        contextRefreshed =
          !!existingSession && existingSession.content_hash !== chatbotContent.hash;
        const shouldSendContent =
          isNewSession || contextRefreshed || !existingSession.previous_interaction_id;

        const chatbotResult = await askUniversityChatbot({
          message: data.message,
          content: chatbotContent,
          previousInteractionId: shouldSendContent
            ? null
            : existingSession.previous_interaction_id,
          shouldSendContent,
        });

        answer = chatbotResult.answer;
        interactionId = chatbotResult.interactionId;
      }

      const session = await prisma.$transaction(async (tx) => {
        const savedSession = existingSession
          ? await tx.chatbotSession.update({
              where: { id: existingSession.id },
              data: {
                previous_interaction_id: interactionId,
                content_hash: chatbotContent?.hash ?? existingSession.content_hash,
              },
            })
          : await tx.chatbotSession.create({
              data: {
                student_id: student.student_id,
                previous_interaction_id: interactionId,
                content_hash: chatbotContent?.hash ?? null,
              },
            });

        await tx.chatbotMessage.createMany({
          data: [
            {
              session_id: savedSession.id,
              sender: "USER",
              content: data.message,
            },
            {
              session_id: savedSession.id,
              sender: "MODEL",
              content: answer,
            },
          ],
        });

        return savedSession;
      });

      return res.status(200).json({
        answer,
        session_id: session.id,
        is_new_session: isNewSession,
        context_refreshed: contextRefreshed,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", issues: err.issues });
      }

      if (err instanceof UniversityChatbotError) {
        return res.status(502).json({ error: err.message });
      }

      throw err;
    }
  },
);
