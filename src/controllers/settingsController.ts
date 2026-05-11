// controllers/system-settings.ts

import { Request, Response } from "express";
import {
  getSystemSettingsSchema,
  updateSystemSettingsSchema,
} from "../validators/settings";
import { prisma } from "../lib/prisma";
import { z } from "zod";

export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: {
        id: true,
        lecture_duration: true,
        lectures_start_time: true,
        aided_pass_courses_number: true,
        aided_marks_number: true,
        theoretical_exam_date: true,
        practical_exam_date: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!settings) {
      return res.status(404).json({ error: "System settings not found" });
    }

    const parsed = getSystemSettingsSchema.parse(settings);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createOrUpdateSystemSettings = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = updateSystemSettingsSchema.parse(req.body);

    const existingSettings = await prisma.systemSettings.findFirst({
      select: {
        id: true,
      },
    });

    const payload = {
      lecture_duration:
        data.lecture_duration !== undefined ? data.lecture_duration : undefined,
      lectures_start_time:
        data.lectures_start_time !== undefined
          ? data.lectures_start_time
          : undefined,
      aided_pass_courses_number:
        data.aided_pass_courses_number !== undefined
          ? data.aided_pass_courses_number
          : undefined,
      aided_marks_number:
        data.aided_marks_number !== undefined
          ? data.aided_marks_number
          : undefined,
      theoretical_exam_date:
        data.theoretical_exam_date !== undefined
          ? data.theoretical_exam_date
            ? new Date(data.theoretical_exam_date)
            : null
          : undefined,
      practical_exam_date:
        data.practical_exam_date !== undefined
          ? data.practical_exam_date
            ? new Date(data.practical_exam_date)
            : null
          : undefined,
    };

    if (!existingSettings) {
      const created = await prisma.systemSettings.create({
        data: {
          lecture_duration: payload.lecture_duration ?? null,
          lectures_start_time: payload.lectures_start_time ?? null,
          aided_pass_courses_number: payload.aided_pass_courses_number ?? null,
          aided_marks_number: payload.aided_marks_number ?? null,
          theoretical_exam_date: payload.theoretical_exam_date ?? null,
          practical_exam_date: payload.practical_exam_date ?? null,
        },
        select: {
          id: true,
          lecture_duration: true,
          lectures_start_time: true,
          aided_pass_courses_number: true,
          aided_marks_number: true,
          theoretical_exam_date: true,
          practical_exam_date: true,
          created_at: true,
          updated_at: true,
        },
      });

      return res.status(201).json(created);
    }

    const updated = await prisma.systemSettings.update({
      where: { id: existingSettings.id },
      data: payload,
      select: {
        id: true,
        lecture_duration: true,
        lectures_start_time: true,
        aided_pass_courses_number: true,
        aided_marks_number: true,
        theoretical_exam_date: true,
        practical_exam_date: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create or update system settings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
