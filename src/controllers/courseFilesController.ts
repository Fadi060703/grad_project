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
      path: `/uploads/course_${courseId}/${uniqueFilename}`,
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

    const created = await prisma.courseFile.create({
      data: {
        course_id: courseId,
        type: data.type,
        file: data.file,
        size: data.size,
        title: data.title,
        mime_type: data.mime_type,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
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

    if (data.file && data.file !== existing.file) {
      await deleteFileIfExists(existing.file);
    }

    const updated = await prisma.courseFile.update({
      where: { id },
      data,
    });

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
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
