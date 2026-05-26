// controllers/sections.ts

import { Request, Response } from "express";
import { createSectionSchema, getSectionsSchema, updateSectionSchema } from "../validators/sections";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";

export const getAllSections = createListHandler({
  prisma: prisma.section,

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

  mapResult: ({ data }) => z.array(getSectionsSchema).parse(data),
});

export const getSectionById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid section ID');
  }
  
  const section = await prisma.section.findUnique({
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
  
  if (!section) {
    throw new NotFoundError('Section');
  }
  
  const parsed = getSectionsSchema.parse(section);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createSection = asyncHandler(async (req: Request, res: Response) => {
  const data = createSectionSchema.parse(req.body);
  
  // Check if year exists
  const yearExists = await prisma.year.findUnique({
    where: { id: data.year_id }
  });
  
  if (!yearExists) {
    throw new NotFoundError('Year');
  }
  
  // Check if section with same name exists in the same year
  const existing = await prisma.section.findFirst({
    where: {
      name: data.name,
      year_id: data.year_id
    }
  });
  
  if (existing) {
    throw new ConflictError('Section with this name already exists in the selected year');
  }
  
  const created = await prisma.section.create({
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
    message: 'Section created successfully',
    data: created
  });
});

export const updateSection = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid section ID');
  }
  
  const data = updateSectionSchema.parse(req.body);
  
  // Check if section exists
  const existingSection = await prisma.section.findUnique({
    where: { id }
  });
  
  if (!existingSection) {
    throw new NotFoundError('Section');
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
  const checkYearId = data.year_id !== undefined ? data.year_id : existingSection.year_id;
  const checkName = data.name !== undefined ? data.name : existingSection.name;
  
  const duplicate = await prisma.section.findFirst({
    where: {
      name: checkName,
      year_id: checkYearId,
      id: { not: id }
    }
  });
  
  if (duplicate) {
    throw new ConflictError('Section with this name already exists in the selected year');
  }
  
  const updated = await prisma.section.update({
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
    message: 'Section updated successfully',
    data: updated
  });
});

export const deleteSection = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid section ID');
  }
  
  const existingSection = await prisma.section.findUnique({
    where: { id },
    include: {
      groups: true
    }
  });
  
  if (!existingSection) {
    throw new NotFoundError('Section');
  }
  
  // Check if section has groups
  if (existingSection.groups.length > 0) {
    throw new BadRequestError('Cannot delete section with existing groups. Delete associated groups first.');
  }
  
  const deleted = await prisma.section.delete({
    where: { id },
    select: {
      id: true,
      name: true,
      year_id: true
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'Section deleted successfully',
    data: deleted
  });
});