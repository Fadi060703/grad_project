import { Request, Response } from "express";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { createListHandler } from "../lib/express-prisma-query";
import { prisma } from "../lib/prisma";
import {
  createCourseFileSchema,
  getCourseFileSchema,
  updateCourseFileSchema,
} from "../validators/coursesFiles";
import {
  AiStudyMaterialGenerationError,
  generateCourseFileStudyMaterials,
  parseStoredFlashcards,
  parseStoredSummary,
  type GeneratedStudyMaterials,
} from "../services/aiStudyMaterialsService";
import {
  renderFlashcardsHtml,
  renderSummaryHtml,
} from "../services/courseFileAiHtmlService";
import { asyncHandler } from "../utils/asyncHandler";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_PREFIX = "image/";
const ALLOWED_MIME_EXACT = new Set(["application/pdf"]);

const sanitizeFilename = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const parseCourseId = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parsePositiveInt = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
};

const resolveDiskPath = (storedPath: string) => {
  if (!storedPath) {
    return null;
  }

  let cleaned = storedPath.trim().replace(/^[\\/]+/, "");
  if (cleaned.startsWith("public/")) {
    cleaned = cleaned.slice("public/".length);
  }

  return join(process.cwd(), "public", cleaned);
};

const deleteFileIfExists = async (storedPath: string) => {
  const diskPath = resolveDiskPath(storedPath);
  if (!diskPath) {
    return;
  }

  try {
    await unlink(diskPath);
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      throw err;
    }
  }
};

export const uploadCourseFile = async (req: Request, res: Response) => {
  try {
    const courseId = parseCourseId(req.params.course_id);
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

    const file = (req as Request & { file?: UploadedFile }).file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!file.mimetype) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const mt = file.mimetype.toLowerCase();
    const isAllowed =
      mt.startsWith(ALLOWED_MIME_PREFIX) || ALLOWED_MIME_EXACT.has(mt);

    if (!isAllowed) {
      return res
        .status(400)
        .json({ error: "Only images and PDF files are allowed" });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res
        .status(400)
        .json({ error: "The file must be 10 MB or smaller" });
    }

    const buffer =
      file.buffer ?? (file.path ? await readFile(file.path) : null);

    if (!buffer) {
      return res.status(500).json({ error: "Failed to read uploaded file" });
    }

    const uploadDir = join(
      process.cwd(),
      "public",
      "uploads",
      "courses_files",
      `course_${courseId}`,
    );
    await mkdir(uploadDir, { recursive: true });

    const safeName = sanitizeFilename(file.originalname || "file");
    const uniqueFilename = `${Date.now()}-${safeName}`;
    const filePath = join(uploadDir, uniqueFilename);

    await writeFile(filePath, buffer);

    return res.status(201).json({
      message: "File uploaded successfully",
      filename: uniqueFilename,
      mimetype: file.mimetype,
      size: buffer.length,
      path: `/uploads/courses_files/course_${courseId}/${uniqueFilename}`,
    });
  } catch (err) {
    console.error("Upload course file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const listCourseFilesHandler = createListHandler({
  prisma: prisma.courseFile,
  allowedSortFields: [
    "id",
    "title",
    "type",
    "size",
    "mime_type",
    "created_at",
    "updated_at",
  ],
  fieldTypes: {
    id: "number",
    title: "text",
    type: "text",
    size: "number",
    mime_type: "text",
    created_at: "date",
    updated_at: "date",
    course_id: "number",
  },
  searchableFields: ["title", "file", "mime_type"],
  handleFindArgs: ({ req, findManyArgs }) => {
    const courseId = (req as Request & { courseId?: number }).courseId;
    return {
      ...findManyArgs,
      where: {
        ...findManyArgs.where,
        course_id: courseId,
      },
    };
  },
  mapResult: ({ data }) => z.array(getCourseFileSchema).parse(data),
});

export const getAllCourseFiles = asyncHandler(
  async (req: Request, res: Response, next) => {
    const courseId = parseCourseId(req.params.course_id);
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

    (req as Request & { courseId?: number }).courseId = courseId;
    return listCourseFilesHandler(req, res, next);
  },
);

export const createCourseFile = async (req: Request, res: Response) => {
  try {
    const courseId = parseCourseId(req.params.course_id);
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

    const data = createCourseFileSchema.parse(req.body);

    const aiMaterials = await generateCourseFileStudyMaterials({
      courseId,
      courseType: data.type,
      title: data.title,
      file: data.file,
      mimeType: data.mime_type,
      size: data.size,
    });

    const created = await prisma.$transaction(async (tx) => {
      const courseFile = await tx.courseFile.create({
        data: {
          course_id: courseId,
          type: data.type,
          file: data.file,
          size: data.size,
          title: data.title,
          mime_type: data.mime_type,
        },
      });

      await tx.courseFileFlashcards.create({
        data: {
          course_id: courseId,
          course_file_id: courseFile.id,
          course_type: courseFile.type,
          cards: aiMaterials.flashcards,
        },
      });

      await tx.courseFileSummary.create({
        data: {
          course_id: courseId,
          course_file_id: courseFile.id,
          course_type: courseFile.type,
          summary: aiMaterials.summary,
        },
      });

      return courseFile;
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }

    if (err instanceof AiStudyMaterialGenerationError) {
      return res.status(502).json({ error: err.message });
    }

    return res.status(400).json({ error: err });
  }
};

export const updateCourseFile = async (req: Request, res: Response) => {
  try {
    const courseId = parseCourseId(req.params.course_id);
    const id = parsePositiveInt(req.params.id);

    if (!courseId || !id) {
      return res.status(400).json({ error: "Invalid course file id" });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const existing = await prisma.courseFile.findFirst({
      where: { id, course_id: courseId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Course file not found" });
    }

    const data = updateCourseFileSchema.parse(req.body);
    const fileChanged = !!data.file && data.file !== existing.file;
    let aiMaterials: GeneratedStudyMaterials | null = null;

    if (fileChanged) {
      aiMaterials = await generateCourseFileStudyMaterials({
        courseId,
        courseType: data.type ?? existing.type,
        title: data.title ?? existing.title,
        file: data.file!,
        mimeType: data.mime_type ?? existing.mime_type,
        size: data.size ?? existing.size,
      });

      await deleteFileIfExists(existing.file);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const courseFile = await tx.courseFile.update({
        where: { id },
        data,
      });

      if (aiMaterials) {
        await tx.courseFileFlashcards.upsert({
          where: { course_file_id: id },
          create: {
            course_id: courseId,
            course_file_id: id,
            course_type: courseFile.type,
            cards: aiMaterials.flashcards,
          },
          update: {
            course_id: courseId,
            course_type: courseFile.type,
            cards: aiMaterials.flashcards,
          },
        });

        await tx.courseFileSummary.upsert({
          where: { course_file_id: id },
          create: {
            course_id: courseId,
            course_file_id: id,
            course_type: courseFile.type,
            summary: aiMaterials.summary,
          },
          update: {
            course_id: courseId,
            course_type: courseFile.type,
            summary: aiMaterials.summary,
          },
        });
      } else if (data.type && data.type !== existing.type) {
        await tx.courseFileFlashcards.updateMany({
          where: { course_file_id: id },
          data: { course_type: data.type },
        });
        await tx.courseFileSummary.updateMany({
          where: { course_file_id: id },
          data: { course_type: data.type },
        });
      }

      return courseFile;
    });

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }

    if (err instanceof AiStudyMaterialGenerationError) {
      return res.status(502).json({ error: err.message });
    }

    return res.status(400).json({ error: err });
  }
};

const sendFlashcardsHtml = async (
  res: Response,
  where: { course_file_id: number; course_id?: number },
) => {
  const flashcardsRow = await prisma.courseFileFlashcards.findFirst({
    where,
    include: {
      courseFile: { select: { title: true, type: true } },
    },
  });

  if (!flashcardsRow) {
    return res.status(404).json({ error: "Flashcards not found" });
  }

  const cards = parseStoredFlashcards(flashcardsRow.cards);
  const html = renderFlashcardsHtml({
    title: flashcardsRow.courseFile.title,
    courseType: flashcardsRow.course_type,
    cards,
  });

  return res.status(200).type("html").send(html);
};

const sendSummaryHtml = async (
  res: Response,
  where: { course_file_id: number; course_id?: number },
) => {
  const summaryRow = await prisma.courseFileSummary.findFirst({
    where,
    include: {
      courseFile: { select: { title: true, type: true } },
    },
  });

  if (!summaryRow) {
    return res.status(404).json({ error: "Summary not found" });
  }

  const summary = parseStoredSummary(summaryRow.summary);
  const html = renderSummaryHtml({
    title: summaryRow.courseFile.title,
    courseType: summaryRow.course_type,
    summary,
  });

  return res.status(200).type("html").send(html);
};

export const getCourseFileFlashcardsHtml = async (
  req: Request,
  res: Response,
) => {
  try {
    const courseId = parseCourseId(req.params.course_id);
    const id = parsePositiveInt(req.params.id);

    if (!courseId || !id) {
      return res.status(400).json({ error: "Invalid course file id" });
    }

    return await sendFlashcardsHtml(res, {
      course_id: courseId,
      course_file_id: id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(500).json({ error: "Stored flashcards data is invalid" });
    }
    return res.status(400).json({ error: err });
  }
};

export const getCourseFileSummaryHtml = async (req: Request, res: Response) => {
  try {
    const courseId = parseCourseId(req.params.course_id);
    const id = parsePositiveInt(req.params.id);

    if (!courseId || !id) {
      return res.status(400).json({ error: "Invalid course file id" });
    }

    return await sendSummaryHtml(res, {
      course_id: courseId,
      course_file_id: id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(500).json({ error: "Stored summary data is invalid" });
    }
    return res.status(400).json({ error: err });
  }
};

export const getCourseFileFlashcardsHtmlById = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid course file id" });
    }

    return await sendFlashcardsHtml(res, { course_file_id: id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(500).json({ error: "Stored flashcards data is invalid" });
    }
    return res.status(400).json({ error: err });
  }
};

export const getCourseFileSummaryHtmlById = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid course file id" });
    }

    return await sendSummaryHtml(res, { course_file_id: id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(500).json({ error: "Stored summary data is invalid" });
    }
    return res.status(400).json({ error: err });
  }
};

export const deleteCourseFile = async (req: Request, res: Response) => {
  try {
    const courseId = parseCourseId(req.params.course_id);
    const id = parsePositiveInt(req.params.id);

    if (!courseId || !id) {
      return res.status(400).json({ error: "Invalid course file id" });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const existing = await prisma.courseFile.findFirst({
      where: { id, course_id: courseId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Course file not found" });
    }

    await deleteFileIfExists(existing.file);

    const deleted = await prisma.courseFile.delete({
      where: { id },
    });

    return res.status(200).json(deleted);
  } catch (err) {
    return res.status(400).json({ error: err });
  }
};
