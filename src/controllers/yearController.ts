// controllers/yearController.ts

import { Request, Response } from "express";
import { createListHandler } from "../lib/express-prisma-query";
import { asyncHandler } from "../utils/asyncHandler";
import { UnauthorizedError, NotFoundError, ConflictError, 
BadRequestError, ForbiddenError, ValidationError } from "../errors";
import { prisma } from "../lib/prisma";
import { yearSchema, createYearSchema, updateYearSchema } from "../validators/years";
import { z } from 'zod';

export const getAllYears = createListHandler({
  prisma: prisma.year,
  allowedSortFields: ["id", "name", "order"],
  fieldTypes: {
    id: "number",
    name: "text",
    order: "number",
  },
  searchableFields: ["name"],
  findManyArgs: {
    select: {
      id: true,
      name: true,
      order: true,
      has_majors: true,
      sections: {
        select: {
          id: true,
          name: true,
          year_id: true,
        }
      },
      majors: {
        select: {
          id: true,
          name: true,
          year_id: true,
        }
      }
    },
  } as any,
  mapResult: ({ data }) => z.array(yearSchema).parse(data),
});

export const getYearById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  // Validate ID
  if (isNaN(id)) {
    throw new BadRequestError('Invalid year ID');
  }
  
  const year = await prisma.year.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      order: true,
      has_majors: true,
      sections: {
        select: {
          id: true,
          name: true,
          year_id: true,
        }
      },
      majors: {
        select: {
          id: true,
          name: true,
          year_id: true,
        }
      }
    }
  });
  
  if (!year) {
    throw new NotFoundError('Year');
  }
  
  const parsed = yearSchema.parse(year);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createYear = asyncHandler(async (req: Request, res: Response) => {
  const data = createYearSchema.parse(req.body);
  
  // Check for duplicate name
  const existingName = await prisma.year.findUnique({
    where: { name: data.name }
  });
  
  if (existingName) {
    throw new ConflictError('Year with this name already exists');
  }
  
  // Check for duplicate order
  if (data.order) {
    const existingOrder = await prisma.year.findUnique({
      where: { order: data.order }
    });
    
    if (existingOrder) {
      throw new ConflictError(`Year with order ${data.order} already exists`);
    }
  }
  
  const created = await prisma.year.create({
    data: {
      name: data.name,
      order: data.order,
      has_majors: data.has_majors ?? false,
    },
    select: {
      id: true,
      name: true,
      order: true,
      has_majors: true,
    }
  });

  return res.status(201).json({
    success: true,
    message: 'Year created successfully',
    data: created
  });
});

export const updateYear = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid year ID');
  }
  
  const data = updateYearSchema.parse(req.body);
  
  // Check if year exists
  const existingYear = await prisma.year.findUnique({
    where: { id }
  });
  
  if (!existingYear) {
    throw new NotFoundError('Year');
  }
  
  // Check for duplicate name (if name is being changed)
  if (data.name && data.name !== existingYear.name) {
    const duplicateName = await prisma.year.findUnique({
      where: { name: data.name }
    });
    
    if (duplicateName) {
      throw new ConflictError('Year with this name already exists');
    }
  }
  
  // Check for duplicate order (if order is being changed)
  if (data.order && data.order !== existingYear.order) {
    const duplicateOrder = await prisma.year.findUnique({
      where: { order: data.order }
    });
    
    if (duplicateOrder) {
      throw new ConflictError(`Year with order ${data.order} already exists`);
    }
  }
  
  const updated = await prisma.year.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name : undefined,
      order: data.order !== undefined ? data.order : undefined,
      has_majors: data.has_majors !== undefined ? data.has_majors : undefined,
    },
    select: {
      id: true,
      name: true,
      order: true,
      has_majors: true,
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'Year updated successfully',
    data: updated
  });
});

export const deleteYear = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid year ID');
  }
  
  const existingYear = await prisma.year.findUnique({
    where: { id },
    include: {
      sections: true,
      majors: true,
      students: true,
      announcements: true
    }
  });
  
  if (!existingYear) {
    throw new NotFoundError('Year');
  }
  
  // Check if year has related data
  if (existingYear.sections.length > 0 || 
      existingYear.majors.length > 0 || 
      existingYear.students.length > 0 || 
      existingYear.announcements.length > 0) {
    throw new BadRequestError('Cannot delete year with existing sections, majors, students, or announcements. Delete associated records first.');
  }
  
  const deleted = await prisma.year.delete({
    where: { id },
    select: {
      id: true,
      name: true,
      order: true,
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'Year deleted successfully',
    data: deleted
  });
});