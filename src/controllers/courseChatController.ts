import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { parseStoredSummary } from "../services/aiStudyMaterialsService";
import {
  askCourseChat,
  CourseChatError,
  createSummariesHash,
} from "../services/courseChatService";

const courseChatRequestSchema = z.object({
  course_id: z.number().int().positive(),
  question: z.string().trim().min(1).max(3000),
});

const parsePositiveInt = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getAuthUser = (req: Request) => {
  const { id, role } = req.user as { id: number | string; role: string };
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return { id: userId, role };
};

const getStudentForCourseAccess = async (userId: number, courseId: number) =>
  prisma.student.findUnique({
    where: { userId },
    select: {
      student_id: true,
      courses: {
        where: { course_id: courseId, status: "ENROLLED" },
        select: { course_id: true },
      },
    },
  });

const assertCourseChatAccess = async (params: {
  userId: number;
  role: string;
  courseId: number;
}) => {
  if (params.role !== "STUDENT") {
    return { studentId: null as number | null };
  }

  const student = await getStudentForCourseAccess(params.userId, params.courseId);
  if (!student || student.courses.length === 0) {
    return null;
  }

  return { studentId: student.student_id };
};

const getCourseSummaries = async (courseId: number) => {
  const files = await prisma.courseFile.findMany({
    where: { course_id: courseId, summary: { isNot: null } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      summary: { select: { summary: true } },
    },
  });

  return files.map((file) => ({
    courseFileId: file.id,
    title: file.title,
    courseType: file.type,
    summary: parseStoredSummary(file.summary!.summary),
  }));
};

export const courseChat = asyncHandler(async (req: Request, res: Response) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const data = courseChatRequestSchema.parse(req.body);

    const course = await prisma.course.findUnique({
      where: { id: data.course_id },
      select: { id: true },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const access = await assertCourseChatAccess({
      userId: authUser.id,
      role: authUser.role,
      courseId: data.course_id,
    });

    if (!access) {
      return res.status(403).json({ error: "Student is not enrolled in this course" });
    }

    const summaries = await getCourseSummaries(data.course_id);
    if (summaries.length === 0) {
      return res.status(404).json({ error: "This course does not have lectures yet" });
    }

    const summariesHash = createSummariesHash(summaries);
    const existingSession = await prisma.courseAiChatSession.findUnique({
      where: {
        user_id_course_id: {
          user_id: authUser.id,
          course_id: data.course_id,
        },
      },
      select: {
        id: true,
        previous_interaction_id: true,
        summaries_hash: true,
      },
    });

    const isNewSession = !existingSession;
    const contextRefreshed =
      !!existingSession && existingSession.summaries_hash !== summariesHash;
    const shouldSendSummaries = isNewSession || contextRefreshed;

    const chatResult = await askCourseChat({
      question: data.question,
      summaries,
      previousInteractionId: shouldSendSummaries
        ? null
        : existingSession.previous_interaction_id,
      shouldSendSummaries,
    });

    const session = await prisma.$transaction(async (tx) => {
      const savedSession = existingSession
        ? await tx.courseAiChatSession.update({
            where: { id: existingSession.id },
            data: {
              previous_interaction_id: chatResult.interactionId,
              summaries_hash: summariesHash,
              student_id: access.studentId,
            },
          })
        : await tx.courseAiChatSession.create({
            data: {
              user_id: authUser.id,
              student_id: access.studentId,
              course_id: data.course_id,
              previous_interaction_id: chatResult.interactionId,
              summaries_hash: summariesHash,
            },
          });

      await tx.courseAiChatMessage.createMany({
        data: [
          {
            session_id: savedSession.id,
            sender: "USER",
            content: data.question,
          },
          {
            session_id: savedSession.id,
            sender: "MODEL",
            content: chatResult.answer,
          },
        ],
      });

      return savedSession;
    });

    return res.status(200).json({
      answer: chatResult.answer,
      session_id: session.id,
      is_new_session: isNewSession,
      context_refreshed: contextRefreshed,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    }

    if (err instanceof CourseChatError) {
      return res.status(502).json({ error: err.message });
    }

    throw err;
  }
});

export const getCourseChatMessages = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const authUser = getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ error: "UNAUTHORIZED" });
      }

      const courseId = parsePositiveInt(req.params.course_id);
      if (!courseId) {
        return res.status(400).json({ error: "Invalid course_id" });
      }

      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });

      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      const access = await assertCourseChatAccess({
        userId: authUser.id,
        role: authUser.role,
        courseId,
      });

      if (!access) {
        return res.status(403).json({ error: "Student is not enrolled in this course" });
      }

      const session = await prisma.courseAiChatSession.findUnique({
        where: {
          user_id_course_id: {
            user_id: authUser.id,
            course_id: courseId,
          },
        },
        select: {
          id: true,
          summaries_hash: true,
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
        summaries_hash: session.summaries_hash,
        messages: session.messages,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", issues: err.issues });
      }

      throw err;
    }
  },
);
