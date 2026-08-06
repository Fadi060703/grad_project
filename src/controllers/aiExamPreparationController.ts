import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { parseStoredSummary } from "../services/aiStudyMaterialsService";
import {
  AiExamPreparationError,
  generateExamPreparation,
} from "../services/aiExamPreparationService";
import { renderExamPreparationHtml } from "../services/aiExamPreparationHtmlService";

const examPreparationRequestSchema = z.object({
  course_file_ids: z.array(z.number().int().positive()).min(1),
  question_count: z.number().int().min(5).max(60).default(30),
});

const getAuthUser = (req: Request) => {
  const { id, role } = req.user as { id: number | string; role: string };
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return { id: userId, role };
};

const assertStudentCanAccessCourse = async (userId: number, courseId: number) => {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      student_id: true,
      courses: {
        where: { course_id: courseId, status: "ENROLLED" },
        select: { course_id: true },
      },
    },
  });

  return !!student && student.courses.length > 0;
};

export const generateExamPreparationHtml = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const authUser = getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ error: "UNAUTHORIZED" });
      }

      const data = examPreparationRequestSchema.parse(req.body);
      const uniqueCourseFileIds = [...new Set(data.course_file_ids)];

      const courseFiles = await prisma.courseFile.findMany({
        where: { id: { in: uniqueCourseFileIds } },
        select: {
          id: true,
          course_id: true,
          type: true,
          title: true,
          summary: {
            select: { summary: true },
          },
        },
      });

      if (courseFiles.length === 0) {
        return res.status(404).json({ error: "No selected course files were found" });
      }

      const courseIds = [...new Set(courseFiles.map((file) => file.course_id))];
      if (courseIds.length !== 1) {
        return res
          .status(400)
          .json({ error: "Selected course files must belong to one course" });
      }

      const courseId = courseIds[0];
      if (authUser.role === "STUDENT") {
        const canAccess = await assertStudentCanAccessCourse(authUser.id, courseId);
        if (!canAccess) {
          return res
            .status(403)
            .json({ error: "Student is not enrolled in this course" });
        }
      }

      const summarizedFiles = courseFiles.filter((file) => file.summary);
      if (summarizedFiles.length === 0) {
        return res.status(404).json({
          error: "None of the selected course files have generated summaries yet",
        });
      }

      const summaries = summarizedFiles.map((file) => ({
        courseFileId: file.id,
        title: file.title,
        courseType: file.type,
        summary: parseStoredSummary(file.summary!.summary),
      }));

      const exam = await generateExamPreparation({
        questionCount: data.question_count,
        summaries,
      });

      return res.status(200).type("html").send(renderExamPreparationHtml(exam));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", issues: err.issues });
      }

      if (err instanceof AiExamPreparationError) {
        return res.status(502).json({ error: err.message });
      }

      throw err;
    }
  },
);
