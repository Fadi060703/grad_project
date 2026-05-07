// controllers/system-settings.ts

import { Request, Response } from "express";
import { createSystemSettingsSchema, getSystemSettingsSchema, updateSystemSettingsSchema } from "../validators/settings";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';

export const getAllSystemSettings = createListHandler({
  prisma: prisma.systemSettings,

  allowedSortFields: ["id", "created_at", "updated_at", "lecture_duration", "aided_pass_courses_number", "aided_marks_number"],

  fieldTypes: {
    id: "number",
    lecture_duration: "number",
    lectures_start_time: "text",
    aided_pass_courses_number: "number",
    aided_marks_number: "number",
    theoretical_exam_date: "date",
    practical_exam_date: "date",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: [],

  findManyArgs: {
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
  } as any,

  mapResult: ({ data }) => z.array(getSystemSettingsSchema).parse(data),
});

export const getSystemSettingsById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const settings = await prisma.systemSettings.findUnique({
      where: { id },
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
      }
    });
    
    if (!settings) {
      return res.status(404).json({ error: "System settings not found" });
    }
    
    const parsed = getSystemSettingsSchema.parse(settings);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed"});
    }
    return res.status(400).json({ error: err });
  }
};

export const createSystemSettings = async (req: Request, res: Response) => {
  try {
    const data = createSystemSettingsSchema.parse(req.body);
    
    // Check if settings already exist (singleton pattern)
    const existingSettings = await prisma.systemSettings.findFirst();
    
    if (existingSettings) {
      return res.status(409).json({ error: "System settings already exist. Use update instead." });
    }
    
    const created = await prisma.systemSettings.create({
      data: {
        lecture_duration: data.lecture_duration ?? null,
        lectures_start_time: data.lectures_start_time ?? null,
        aided_pass_courses_number: data.aided_pass_courses_number ?? null,
        aided_marks_number: data.aided_marks_number ?? null,
        theoretical_exam_date: data.theoretical_exam_date ? new Date(data.theoretical_exam_date) : null,
        practical_exam_date: data.practical_exam_date ? new Date(data.practical_exam_date) : null,
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
      }
    });
    
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create system settings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateSystemSettingsSchema.parse(req.body);
    
    // Check if settings exist
    const existingSettings = await prisma.systemSettings.findUnique({
      where: { id }
    });
    
    if (!existingSettings) {
      return res.status(404).json({ error: "System settings not found" });
    }
    
    const updateData: {
      lecture_duration?: number | null;
      lectures_start_time?: string | null;
      aided_pass_courses_number?: number | null;
      aided_marks_number?: number | null;
      theoretical_exam_date?: Date | null;
      practical_exam_date?: Date | null;
    } = {};
    
    if (data.lecture_duration !== undefined) updateData.lecture_duration = data.lecture_duration;
    if (data.lectures_start_time !== undefined) updateData.lectures_start_time = data.lectures_start_time;
    if (data.aided_pass_courses_number !== undefined) updateData.aided_pass_courses_number = data.aided_pass_courses_number;
    if (data.aided_marks_number !== undefined) updateData.aided_marks_number = data.aided_marks_number;
    if (data.theoretical_exam_date !== undefined) updateData.theoretical_exam_date = data.theoretical_exam_date ? new Date(data.theoretical_exam_date) : null;
    if (data.practical_exam_date !== undefined) updateData.practical_exam_date = data.practical_exam_date ? new Date(data.practical_exam_date) : null;
    
    const updated = await prisma.systemSettings.update({
      where: { id },
      data: updateData,
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
      }
    });
    
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update system settings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteSystemSettings = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const existingSettings = await prisma.systemSettings.findUnique({
      where: { id }
    });
    
    if (!existingSettings) {
      return res.status(404).json({ error: "System settings not found" });
    }
    
    const deleted = await prisma.systemSettings.delete({
      where: { id },
      select: {
        id: true,
        lecture_duration: true,
        lectures_start_time: true,
        aided_pass_courses_number: true,
        aided_marks_number: true,
        theoretical_exam_date: true,
        practical_exam_date: true,
      }
    });
    
    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete system settings error:", err);
    return res.status(400).json({ error: err });
  }
};

// Optional: Get singleton settings (if you want a single settings record)
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
      }
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