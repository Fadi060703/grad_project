// controllers/faculityInfo.ts

import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getFaculityInfoSchema,
  updateFaculityInfoSchema,
} from "../validators/faculityInfo";
import { asyncHandler } from "../utils/asyncHandler";
import { NotFoundError, BadRequestError } from "../errors";

export const getFaculityInfo = asyncHandler(async (req: Request, res: Response) => {
  const faculityInfo = await prisma.faculityInfo.findFirst({
    select: {
      id: true,
      telegram_url: true,
      facebook_url: true,
      instagram_url: true,
      linkedin_url: true,
      website_url: true,
      university_name: true,
      faculity_name: true,
      faculity_picture_url: true,
      support_email: true,
      lectures_schedule_url: true,
      theoritical_exam_schedule_url: true,
      practical_exam_schedule_url: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!faculityInfo) {
    throw new NotFoundError('Faculty info');
  }

  const parsed = getFaculityInfoSchema.parse(faculityInfo);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createOrUpdateFaculityInfo = asyncHandler(async (req: Request, res: Response) => {
  const data = updateFaculityInfoSchema.parse(req.body);

  const existing = await prisma.faculityInfo.findFirst({
    select: { id: true },
  });

  const payload = {
    telegram_url: data.telegram_url !== undefined ? data.telegram_url : undefined,
    facebook_url: data.facebook_url !== undefined ? data.facebook_url : undefined,
    instagram_url: data.instagram_url !== undefined ? data.instagram_url : undefined,
    linkedin_url: data.linkedin_url !== undefined ? data.linkedin_url : undefined,
    website_url: data.website_url !== undefined ? data.website_url : undefined,
    university_name: data.university_name !== undefined ? data.university_name : undefined,
    faculity_name: data.faculity_name !== undefined ? data.faculity_name : undefined,
    faculity_picture_url: data.faculity_picture_url !== undefined ? data.faculity_picture_url : undefined,
    support_email: data.support_email !== undefined ? data.support_email : undefined,
    lectures_schedule_url: data.lectures_schedule_url !== undefined ? data.lectures_schedule_url : undefined,
    theoritical_exam_schedule_url: data.theoritical_exam_schedule_url !== undefined ? data.theoritical_exam_schedule_url : undefined,
    practical_exam_schedule_url: data.practical_exam_schedule_url !== undefined ? data.practical_exam_schedule_url : undefined,
  };

  if (!existing) {
    const created = await prisma.faculityInfo.create({
      data: {
        telegram_url: payload.telegram_url ?? null,
        facebook_url: payload.facebook_url ?? null,
        instagram_url: payload.instagram_url ?? null,
        linkedin_url: payload.linkedin_url ?? null,
        website_url: payload.website_url ?? null,
        university_name: payload.university_name ?? null,
        faculity_name: payload.faculity_name ?? null,
        faculity_picture_url: payload.faculity_picture_url ?? null,
        support_email: payload.support_email ?? null,
        lectures_schedule_url: payload.lectures_schedule_url ?? null,
        theoritical_exam_schedule_url: payload.theoritical_exam_schedule_url ?? null,
        practical_exam_schedule_url: payload.practical_exam_schedule_url ?? null,
      },
      select: {
        id: true,
        telegram_url: true,
        facebook_url: true,
        instagram_url: true,
        linkedin_url: true,
        website_url: true,
        university_name: true,
        faculity_name: true,
        faculity_picture_url: true,
        support_email: true,
        lectures_schedule_url: true,
        theoritical_exam_schedule_url: true,
        practical_exam_schedule_url: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Faculty info created successfully',
      data: created
    });
  }

  const updated = await prisma.faculityInfo.update({
    where: { id: existing.id },
    data: payload,
    select: {
      id: true,
      telegram_url: true,
      facebook_url: true,
      instagram_url: true,
      linkedin_url: true,
      website_url: true,
      university_name: true,
      faculity_name: true,
      faculity_picture_url: true,
      support_email: true,
      lectures_schedule_url: true,
      theoritical_exam_schedule_url: true,
      practical_exam_schedule_url: true,
      created_at: true,
      updated_at: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'Faculty info updated successfully',
    data: updated
  });
});