// controllers/majors.ts

import { Request, Response } from "express";
import { createMajorSchema, getMajorsSchema, updateMajorSchema } from "../validators/major";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';

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

export const getMajorById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
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
      return res.status(404).json({ error: "Major not found" });
    }
    
    const parsed = getMajorsSchema.parse(major);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createMajor = async (req: Request, res: Response) => {
  try {
    const data = createMajorSchema.parse(req.body);
    
    // Check if year exists
    const yearExists = await prisma.year.findUnique({
      where: { id: data.year_id }
    });
    
    if (!yearExists) {
      return res.status(404).json({ error: "Year not found" });
    }
    
    // Check if major with same name exists in the same year
    const existing = await prisma.major.findFirst({
      where: {
        name: data.name,
        year_id: data.year_id
      }
    });
    
    if (existing) {
      return res.status(409).json({ error: "Major with this name already exists in the selected year" });
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
    
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create major error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateMajor = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateMajorSchema.parse(req.body);
    
    // Check if major exists
    const existingMajor = await prisma.major.findUnique({
      where: { id }
    });
    
    if (!existingMajor) {
      return res.status(404).json({ error: "Major not found" });
    }
    
    const updateData: { name?: string; year_id?: number } = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    
    if (data.year_id !== undefined) {
      // Check if new year exists
      const yearExists = await prisma.year.findUnique({
        where: { id: data.year_id }
      });
      
      if (!yearExists) {
        return res.status(404).json({ error: "Year not found" });
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
      return res.status(409).json({ error: "Major with this name already exists in the selected year" });
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
    
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update major error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMajor = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const existingMajor = await prisma.major.findUnique({
      where: { id },
      include: {
        groups: true
      }
    });
    
    if (!existingMajor) {
      return res.status(404).json({ error: "Major not found" });
    }
    
    // Check if major has groups
    if (existingMajor.groups.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete major with existing groups. Delete associated groups first or reassign them." 
      });
    }
    
    const deleted = await prisma.major.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        year_id: true
      }
    });
    
    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete major error:", err);
    return res.status(400).json({ error: err });
  }
};