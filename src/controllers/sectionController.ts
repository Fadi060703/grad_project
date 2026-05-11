import { Request, Response } from "express"
import { createSectionSchema, getSectionsSchema, updateSectionSchema } from "../validators/sections"
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";

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

export const getSectionById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
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
      return res.status(404).json({ error: "Section not found" });
    }
    
    const parsed = getSectionsSchema.parse(section);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createSection = async (req: Request, res: Response) => {
  try {
    const data = createSectionSchema.parse(req.body);
    
    // Check if section with same name exists in the same year
    const existing = await prisma.section.findFirst({
      where: {
        name: data.name,
        year_id: data.year_id
      }
    });
    
    if (existing) {
      return res.status(409).json({ error: "Section with this name already exists in the selected year" });
    }
    
    // Check if year exists
    const yearExists = await prisma.year.findUnique({
      where: { id: data.year_id }
    });
    
    if (!yearExists) {
      return res.status(404).json({ error: "Year not found" });
    }
    
    const created = await prisma.section.create({
      data: {
        name: data.name,
        year_id: data.year_id  // Direct assignment instead of connect
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
    console.error("Create section error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateSection = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateSectionSchema.parse(req.body);
    
    // Check if section exists
    const existingSection = await prisma.section.findUnique({
      where: { id }
    });
    
    if (!existingSection) {
      return res.status(404).json({ error: "Section not found" });
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
      return res.status(409).json({ error: "Section with this name already exists in the selected year" });
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
    
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update section error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteSection = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const existingSection = await prisma.section.findUnique({
      where: { id },
      include: {
        groups: true
      }
    });
    
    if (!existingSection) {
      return res.status(404).json({ error: "Section not found" });
    }
    
    // Optional: Check if section has groups
    if (existingSection.groups.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete section with existing groups. Delete associated groups first." 
      });
    }
    
    const deleted = await prisma.section.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        year_id: true
      }
    });
    
    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete section error:", err);
    return res.status(400).json({ error: err });
  }
};