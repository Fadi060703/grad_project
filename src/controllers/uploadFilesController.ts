import { Request, Response } from "express";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

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

export const uploadFile = async (req: Request, res: Response) => {
  try {
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

    const uploadDir = join(process.cwd(), "public", "uploads");
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
      path: `/uploads/${uniqueFilename}`,
    });
  } catch (err) {
    console.error("Upload file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
