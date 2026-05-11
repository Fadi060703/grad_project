import { Request , Response } from "express";
import { createListHandler } from "../lib/express-prisma-query";
import { prisma } from "../lib/prisma";
import { yearSchema, createYearSchema, updateYearSchema } from "../validators/years";
import { z } from 'zod';

export const getAllYears = createListHandler({
  prisma: prisma.year,
  allowedSortFields: ["id", "name"],
  fieldTypes: {
    id: "number",
    name: "text",
  },
  searchableFields: ["name"],
  findManyArgs: {
    select: {
      id: true,
      name: true,
      sections: {
        select: {
          id: true,
          name: true,
          year_id: true,
        }
      },
      majors: {  // Added to match frontend interface
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

export const getYearById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const year = await prisma.year.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
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
      return res.status(404).json({ error: "Year not found" });
    }
    
    const parsed = yearSchema.parse(year);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createYear = async (req: Request, res: Response) => {
  try {
    const data = createYearSchema.parse(req.body);
    
    // Check for duplicate name
    const existing = await prisma.year.findUnique({
      where: { name: data.name }
    });
    
    if (existing) {
      return res.status(409).json({ error: "Year with this name already exists" });
    }
    
    const created = await prisma.year.create({
      data: {
        name: data.name
      },
      select: {
        id: true,
        name: true,
      }
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const updateYear = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateYearSchema.parse(req.body);
    
    // Check if year exists
    const existingYear = await prisma.year.findUnique({
      where: { id }
    });
    
    if (!existingYear) {
      return res.status(404).json({ error: "Year not found" });
    }
    
    // Check for duplicate name (if name is being changed)
    if (data.name !== existingYear.name) {
      const duplicateYear = await prisma.year.findUnique({
        where: { name: data.name }
      });
      
      if (duplicateYear) {
        return res.status(409).json({ error: "Year with this name already exists" });
      }
    }
    
    const updated = await prisma.year.update({
      where: { id },
      data: {
        name: data.name
      },
      select: {
        id: true,
        name: true,
      }
    });
    
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const deleteYear = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const existingYear = await prisma.year.findUnique({
      where: { id },
      include: {
        sections: true,
        majors: true
      }
    });
    
    if (!existingYear) {
      return res.status(404).json({ error: "Year not found" });
    }
    
    // Optional: Check if year has related data
    if (existingYear.sections.length > 0 ) {
      return res.status(400).json({ 
        error: "Cannot delete year with existing sections or majors. Delete associated records first." 
      });
    }
    
    const deleted = await prisma.year.delete({
      where: { id },
      select: {
        id: true,
        name: true,
      }
    });
    
    return res.status(200).json(deleted);
  } catch (err) {
    return res.status(400).json({ error: err });
  }
};