// controllers/university-locations.ts

import { Request, Response } from "express";
import { createUniversityLocationSchema, getUniversityLocationSchema, updateUniversityLocationSchema } from "../validators/locations";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';

export const getAllUniversityLocations = createListHandler({
  prisma: prisma.universityLocation,

  allowedSortFields: ["id", "name", "created_at", "updated_at"],

  fieldTypes: {
    id: "number",
    name: "text",
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

export const getUniversityLocationById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
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
      return res.status(404).json({ error: "University location not found" });
    }
    
    const parsed = getUniversityLocationSchema.parse(location);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed"});
    }
    return res.status(400).json({ error: err });
  }
};

export const createUniversityLocation = async (req: Request, res: Response) => {
  try {
    const data = createUniversityLocationSchema.parse(req.body);
    
    // Check for duplicate name
    const existing = await prisma.universityLocation.findUnique({
      where: { name: data.name }
    });
    
    if (existing) {
      return res.status(409).json({ error: "University location with this name already exists" });
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
    
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create university location error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateUniversityLocation = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateUniversityLocationSchema.parse(req.body);
    
    // Check if location exists
    const existingLocation = await prisma.universityLocation.findUnique({
      where: { id }
    });
    
    if (!existingLocation) {
      return res.status(404).json({ error: "University location not found" });
    }
    
    // Check for duplicate name (if name is being changed)
    if (data.name && data.name !== existingLocation.name) {
      const duplicateLocation = await prisma.universityLocation.findUnique({
        where: { name: data.name }
      });
      
      if (duplicateLocation) {
        return res.status(409).json({ error: "University location with this name already exists" });
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
    
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update university location error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteUniversityLocation = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const existingLocation = await prisma.universityLocation.findUnique({
      where: { id }
    });
    
    if (!existingLocation) {
      return res.status(404).json({ error: "University location not found" });
    }
    
    const deleted = await prisma.universityLocation.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        reaching_description: true,
      }
    });
    
    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete university location error:", err);
    return res.status(400).json({ error: err });
  }
};