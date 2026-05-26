// controllers/university-locations.ts

import { Request, Response } from "express";
import { createUniversityLocationSchema, getUniversityLocationSchema, updateUniversityLocationSchema } from "../validators/locations";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";

export const getAllUniversityLocations = createListHandler({
  prisma: prisma.universityLocation,

  allowedSortFields: ["id", "name", "reaching_description", "created_at", "updated_at"],

  fieldTypes: {
    id: "number",
    name: "text",
    reaching_description: "text",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["name", "reaching_description"],

  findManyArgs: {
    select: {
      id: true,
      name: true,
      reaching_description: true,
      created_at: true,
      updated_at: true,
    },
  } as any,

  mapResult: ({ data }) => z.array(getUniversityLocationSchema).parse(data),
});

export const getUniversityLocationById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid university location ID');
  }
  
  const location = await prisma.universityLocation.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      reaching_description: true,
      created_at: true,
      updated_at: true,
    }
  });
  
  if (!location) {
    throw new NotFoundError('University location');
  }
  
  const parsed = getUniversityLocationSchema.parse(location);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createUniversityLocation = asyncHandler(async (req: Request, res: Response) => {
  const data = createUniversityLocationSchema.parse(req.body);
  
  // Check for duplicate name
  const existing = await prisma.universityLocation.findUnique({
    where: { name: data.name }
  });
  
  if (existing) {
    throw new ConflictError('University location with this name already exists');
  }
  
  const created = await prisma.universityLocation.create({
    data: {
      name: data.name,
      reaching_description: data.reaching_description || null,
    },
    select: {
      id: true,
      name: true,
      reaching_description: true,
      created_at: true,
      updated_at: true,
    }
  });
  
  return res.status(201).json({
    success: true,
    message: 'University location created successfully',
    data: created
  });
});

export const updateUniversityLocation = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid university location ID');
  }
  
  const data = updateUniversityLocationSchema.parse(req.body);
  
  // Check if location exists
  const existingLocation = await prisma.universityLocation.findUnique({
    where: { id }
  });
  
  if (!existingLocation) {
    throw new NotFoundError('University location');
  }
  
  // Check for duplicate name (if name is being changed)
  if (data.name && data.name !== existingLocation.name) {
    const duplicateLocation = await prisma.universityLocation.findUnique({
      where: { name: data.name }
    });
    
    if (duplicateLocation) {
      throw new ConflictError('University location with this name already exists');
    }
  }
  
  const updateData: { name?: string; reaching_description?: string | null } = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.reaching_description !== undefined) updateData.reaching_description = data.reaching_description;
  
  const updated = await prisma.universityLocation.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      reaching_description: true,
      created_at: true,
      updated_at: true,
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'University location updated successfully',
    data: updated
  });
});

export const deleteUniversityLocation = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid university location ID');
  }
  
  const existingLocation = await prisma.universityLocation.findUnique({
    where: { id }
  });
  
  if (!existingLocation) {
    throw new NotFoundError('University location');
  }
  
  const deleted = await prisma.universityLocation.delete({
    where: { id },
    select: {
      id: true,
      name: true,
      reaching_description: true,
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'University location deleted successfully',
    data: deleted
  });
});