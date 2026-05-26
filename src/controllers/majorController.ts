// controllers/majors.ts

import { Request, Response } from "express";
import { createMajorSchema, getMajorsSchema, updateMajorSchema } from "../validators/major";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";

export const getAllMajors = createListHandler({
  prisma: prisma.major,

  allowedSortFields: ["id", "name", "year_id"],

  fieldTypes: {
    id: "number",
    name: "text",
    year_id: "number",
  },

  searchableFields: ["name"],

  findManyArgs: {
    select: {
      id: true,
      name: true,
      year_id: true,
      year: {
        select: {
          id: true,
          name: true,
        }
      },
      groups: {
        select: {
          id: true,
          name: true,
        }
      }
    },
  } as any,

  mapResult: ({ data }) => z.array(getMajorsSchema).parse(data),
});

export const getMajorById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid major ID');
  }
  
  const major = await prisma.major.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      year_id: true,
      year: {
        select: {
          id: true,
          name: true,
        }
      },
      groups: {
        select: {
          id: true,
          name: true,
        }
      }
    }
  });
  
  if (!major) {
    throw new NotFoundError('Major');
  }
  
  const parsed = getMajorsSchema.parse(major);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createMajor = asyncHandler(async (req: Request, res: Response) => {
  const data = createMajorSchema.parse(req.body);
  
  // Check if year exists
  const yearExists = await prisma.year.findUnique({
    where: { id: data.year_id }
  });
  
  if (!yearExists) {
    throw new NotFoundError('Year');
  }
  
  // Check if major with same name exists in the same year
  const existing = await prisma.major.findFirst({
    where: {
      name: data.name,
      year_id: data.year_id
    }
  });
  
  if (existing) {
    throw new ConflictError('Major with this name already exists in the selected year');
  }
  
  const created = await prisma.major.create({
    data: {
      name: data.name,
      year_id: data.year_id
    },
    select: {
      id: true,
      name: true,
      year_id: true,
      year: {
        select: {
          id: true,
          name: true,
        }
      }
    }
  });
  
  return res.status(201).json({
    success: true,
    message: 'Major created successfully',
    data: created
  });
});

export const updateMajor = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid major ID');
  }
  
  const data = updateMajorSchema.parse(req.body);
  
  // Check if major exists
  const existingMajor = await prisma.major.findUnique({
    where: { id }
  });
  
  if (!existingMajor) {
    throw new NotFoundError('Major');
  }
  
  const updateData: { name?: string; year_id?: number } = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  
  if (data.year_id !== undefined) {
    // Check if new year exists
    const yearExists = await prisma.year.findUnique({
      where: { id: data.year_id }
    });
    
    if (!yearExists) {
      throw new NotFoundError('Year');
    }
    
    updateData.year_id = data.year_id;
  }
  
  // Check for duplicate name in the same year (if name or year is being changed)
  const checkYearId = data.year_id !== undefined ? data.year_id : existingMajor.year_id;
  const checkName = data.name !== undefined ? data.name : existingMajor.name;
  
  const duplicate = await prisma.major.findFirst({
    where: {
      name: checkName,
      year_id: checkYearId,
      id: { not: id }
    }
  });
  
  if (duplicate) {
    throw new ConflictError('Major with this name already exists in the selected year');
  }
  
  const updated = await prisma.major.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      year_id: true,
      year: {
        select: {
          id: true,
          name: true,
        }
      }
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'Major updated successfully',
    data: updated
  });
});

export const deleteMajor = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid major ID');
  }
  
  const existingMajor = await prisma.major.findUnique({
    where: { id },
    include: {
      groups: true
    }
  });
  
  if (!existingMajor) {
    throw new NotFoundError('Major');
  }
  
  // Check if major has groups
  if (existingMajor.groups.length > 0) {
    throw new BadRequestError('Cannot delete major with existing groups. Delete associated groups first or reassign them.');
  }
  
  const deleted = await prisma.major.delete({
    where: { id },
    select: {
      id: true,
      name: true,
      year_id: true
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'Major deleted successfully',
    data: deleted
  });
});