import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ConflictError, ForbiddenError } from "../errors";
import {
  changeStudentPasswordSchema,
  getStudentProfileSchema,
  updateStudentProfileSchema,
} from "../validators/student-profile";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
};

const MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024;
const PROFILE_PICTURE_UPLOAD_FOLDER = "student-profile-pictures";
const ALLOWED_PROFILE_PICTURE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const sanitizeFilename = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const getAuthStudentUserId = (req: Request) => {
  const { id, role } = req.user as { id: number | string; role: string };
  const userId = Number(id);

  if (role !== "STUDENT" || !Number.isInteger(userId) || userId <= 0) {
    throw new ForbiddenError("Only students can access student profile");
  }

  return userId;
};

const studentProfileSelect = {
  student_id: true,
  mother_name: true,
  exam_seat_number: true,
  birthdate: true,
  profile_picture: true,
  user: {
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      phone_number: true,
      role: true,
    },
  },
  year: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  major: { select: { id: true, name: true } },
  group: { select: { id: true, name: true } },
} as const;

const getStudentProfileByUserId = async (userId: number) =>
  prisma.student.findUnique({
    where: { userId },
    select: studentProfileSelect,
  });

const mapStudentProfile = (student: Awaited<ReturnType<typeof getStudentProfileByUserId>>) => {
  if (!student || student.user.role !== "STUDENT") {
    throw new ForbiddenError("Student profile not found");
  }

  return {
    student_id: student.student_id,
    full_name: student.user.full_name,
    username: student.user.username,
    email: student.user.email,
    phone_number: student.user.phone_number,
    mother_name: student.mother_name,
    exam_seat_number: student.exam_seat_number,
    birthdate: student.birthdate,
    profile_picture: student.profile_picture,
    year: student.year,
    section: student.section,
    major: student.major,
    group: student.group,
  };
};

const resolveDiskPath = (storedPath: string | null | undefined) => {
  if (!storedPath) {
    return null;
  }

  const trimmed = storedPath.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) {
    return null;
  }

  let cleaned = trimmed.replace(/^[\\/]+/, "");
  if (cleaned.startsWith("public/")) {
    cleaned = cleaned.slice("public/".length);
  }

  if (!cleaned.startsWith("uploads/")) {
    return null;
  }

  return join(process.cwd(), "public", cleaned);
};

const deleteFileIfExists = async (storedPath: string | null | undefined) => {
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

export const getMyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = getAuthStudentUserId(req);
  const student = await getStudentProfileByUserId(userId);
  const parsed = getStudentProfileSchema.parse(mapStudentProfile(student));

  return res.status(200).json({
    success: true,
    data: parsed,
  });
});

export const updateMyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = getAuthStudentUserId(req);
  const data = updateStudentProfileSchema.parse(req.body);

  const student = await getStudentProfileByUserId(userId);
  mapStudentProfile(student);

  const duplicateConditions = [];
  if (data.username !== undefined) duplicateConditions.push({ username: data.username });
  if (data.email !== undefined) duplicateConditions.push({ email: data.email });

  if (duplicateConditions.length > 0) {
    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: duplicateConditions,
      },
      select: { username: true, email: true },
    });

    if (duplicate) {
      const field = duplicate.username === data.username ? "username" : "email";
      throw new ConflictError(`User with this ${field} already exists`);
    }
  }

  const userUpdateData: {
    username?: string;
    email?: string;
    phone_number?: string | null;
  } = {};
  const studentUpdateData: { birthdate?: Date | null } = {};

  if (data.username !== undefined) userUpdateData.username = data.username;
  if (data.email !== undefined) userUpdateData.email = data.email;
  if (data.phone_number !== undefined) userUpdateData.phone_number = data.phone_number;
  if (data.birthdate !== undefined) studentUpdateData.birthdate = data.birthdate;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    if (Object.keys(studentUpdateData).length > 0) {
      await tx.student.update({
        where: { userId },
        data: studentUpdateData,
      });
    }
  });

  const updated = await getStudentProfileByUserId(userId);
  const parsed = getStudentProfileSchema.parse(mapStudentProfile(updated));

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: parsed,
  });
});

export const changeMyStudentPassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = getAuthStudentUserId(req);
  const data = changeStudentPasswordSchema.parse(req.body);

  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      user: {
        select: {
          id: true,
          role: true,
          password: true,
        },
      },
    },
  });

  if (!student || student.user.role !== "STUDENT") {
    throw new ForbiddenError("Student profile not found");
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    data.current_password,
    student.user.password,
  );

  if (!isCurrentPasswordValid) {
    throw new BadRequestError("Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(data.new_password, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });
});

export const uploadMyStudentProfilePicture = asyncHandler(async (req: Request, res: Response) => {
  const userId = getAuthStudentUserId(req);
  const student = await getStudentProfileByUserId(userId);
  const currentProfile = mapStudentProfile(student);

  if (!student) {
    throw new ForbiddenError("Student profile not found");
  }

  const file = (req as Request & { file?: UploadedFile }).file;
  if (!file) {
    throw new BadRequestError("No image uploaded");
  }

  const mimetype = file.mimetype?.toLowerCase();
  if (!mimetype || !ALLOWED_PROFILE_PICTURE_MIME_TYPES.has(mimetype)) {
    throw new BadRequestError("Only JPEG, PNG, and WebP images are allowed");
  }

  if (file.size > MAX_PROFILE_PICTURE_SIZE) {
    throw new BadRequestError("Profile picture must be 5 MB or smaller");
  }

  const buffer = file.buffer ?? (file.path ? await readFile(file.path) : null);
  if (!buffer) {
    throw new BadRequestError("Failed to read uploaded image");
  }

  const uploadDir = join(
    process.cwd(),
    "public",
    "uploads",
    PROFILE_PICTURE_UPLOAD_FOLDER,
    `student_${student.student_id}`,
  );
  await mkdir(uploadDir, { recursive: true });

  const safeName = sanitizeFilename(file.originalname || "profile-picture");
  const uniqueFilename = `${Date.now()}-${safeName}`;
  const publicPath = `/uploads/${PROFILE_PICTURE_UPLOAD_FOLDER}/student_${student.student_id}/${uniqueFilename}`;
  const diskPath = join(uploadDir, uniqueFilename);

  await writeFile(diskPath, buffer);

  try {
    await prisma.student.update({
      where: { userId },
      data: { profile_picture: publicPath },
    });
  } catch (err) {
    await deleteFileIfExists(publicPath);
    throw err;
  }

  if (currentProfile.profile_picture && currentProfile.profile_picture !== publicPath) {
    try {
      await deleteFileIfExists(currentProfile.profile_picture);
    } catch (err) {
      console.error("Failed to delete old profile picture:", err);
    }
  }

  const updated = await getStudentProfileByUserId(userId);
  const parsed = getStudentProfileSchema.parse(mapStudentProfile(updated));

  return res.status(200).json({
    success: true,
    message: "Profile picture uploaded successfully",
    data: parsed,
  });
});
