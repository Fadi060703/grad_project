// controllers/groups.ts

import { Request, Response } from "express";
import { createGroupSchema, getGroupsSchema, updateGroupSchema } from "../validators/groups";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';

export const getAllGroups = createListHandler({
  prisma: prisma.group,

  allowedSortFields: ["id", "name", "section_id", "major_id", "created_at", "updated_at"],

  fieldTypes: {
    id: "number",
    name: "text",
    section_id: "number",
    major_id: "number",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["name"],

  findManyArgs: {
    select: {
      id: true,
      name: true,
      section_id: true,
      major_id: true,
      section: {
        select: {
          id: true,
          name: true,
          year_id: true,
          year: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      major: {
        select: {
          id: true,
          name: true,
          year_id: true,
          year: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      created_at: true,
      updated_at: true,
    },
  } as any,

  mapResult: ({ data }) => z.array(getGroupsSchema).parse(data),
});

export const getGroupById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        section_id: true,
        major_id: true,
        section: {
          select: {
            id: true,
            name: true,
            year_id: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        major: {
          select: {
            id: true,
            name: true,
            year_id: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        created_at: true,
        updated_at: true,
      }
    });
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    const parsed = getGroupsSchema.parse(group);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createGroup = async (req: Request, res: Response) => {
  try {
    const data = createGroupSchema.parse(req.body);
    
    // Check if section exists
    const sectionExists = await prisma.section.findUnique({
      where: { id: data.section_id }
    });
    
    if (!sectionExists) {
      return res.status(404).json({ error: "Section not found" });
    }
    
    // Check if major exists (if provided)
    if (data.major_id) {
      const majorExists = await prisma.major.findUnique({
        where: { id: data.major_id }
      });
      
      if (!majorExists) {
        return res.status(404).json({ error: "Major not found" });
      }
    }
    
    // Check if group with same name exists in the same section
    const existing = await prisma.group.findFirst({
      where: {
        name: data.name,
        section_id: data.section_id
      }
    });
    
    if (existing) {
      return res.status(409).json({ error: "Group with this name already exists in the selected section" });
    }
    
    const createData: any = {
      name: data.name,
      section_id: data.section_id
    };
    
    if (data.major_id) {
      createData.major_id = data.major_id;
    }
    
    const created = await prisma.group.create({
      data: createData,
      select: {
        id: true,
        name: true,
        section_id: true,
        major_id: true,
        section: {
          select: {
            id: true,
            name: true,
            year_id: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        major: {
          select: {
            id: true,
            name: true,
            year_id: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        created_at: true,
        updated_at: true,
      }
    });
    
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create group error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateGroupSchema.parse(req.body);
    
    // Check if group exists
    const existingGroup = await prisma.group.findUnique({
      where: { id }
    });
    
    if (!existingGroup) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    const updateData: { name?: string; section_id?: number; major_id?: number | null } = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    
    if (data.section_id !== undefined) {
      // Check if new section exists
      const sectionExists = await prisma.section.findUnique({
        where: { id: data.section_id }
      });
      
      if (!sectionExists) {
        return res.status(404).json({ error: "Section not found" });
      }
      
      updateData.section_id = data.section_id;
    }
    
    if (data.major_id !== undefined) {
      // Check if major exists (if provided and not null)
      if (data.major_id) {
        const majorExists = await prisma.major.findUnique({
          where: { id: data.major_id }
        });
        
        if (!majorExists) {
          return res.status(404).json({ error: "Major not found" });
        }
        updateData.major_id = data.major_id;
      } else {
        // If major_id is null or 0, set major_id to null
        updateData.major_id = null;
      }
    }
    
    // Check for duplicate name in the same section (if name or section is being changed)
    const checkSectionId = data.section_id !== undefined ? data.section_id : existingGroup.section_id;
    const checkName = data.name !== undefined ? data.name : existingGroup.name;
    
    const duplicate = await prisma.group.findFirst({
      where: {
        name: checkName,
        section_id: checkSectionId,
        id: { not: id }
      }
    });
    
    if (duplicate) {
      return res.status(409).json({ error: "Group with this name already exists in the selected section" });
    }
    
    const updated = await prisma.group.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        section_id: true,
        major_id: true,
        section: {
          select: {
            id: true,
            name: true,
            year_id: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        major: {
          select: {
            id: true,
            name: true,
            year_id: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        created_at: true,
        updated_at: true,
      }
    });
    
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update group error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const existingGroup = await prisma.group.findUnique({
      where: { id }
    });
    
    if (!existingGroup) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    const deleted = await prisma.group.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        section_id: true,
        major_id: true,
      }
    });
    
    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete group error:", err);
    return res.status(400).json({ error: err });
  }
};

// Get groups by section
export const getGroupsBySection = async (req: Request, res: Response) => {
  try {
    const section_id = parseInt(req.params.section_id, 10);
    
    const groups = await prisma.group.findMany({
      where: { section_id },
      select: {
        id: true,
        name: true,
        section_id: true,
        major_id: true,
        major: {
          select: {
            id: true,
            name: true,
            year_id: true
          }
        },
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    const parsed = z.array(getGroupsSchema).parse(groups);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

// Get groups by major
export const getGroupsByMajor = async (req: Request, res: Response) => {
  try {
    const major_id = parseInt(req.params.major_id, 10);
    
    const groups = await prisma.group.findMany({
      where: { major_id },
      select: {
        id: true,
        name: true,
        section_id: true,
        major_id: true,
        section: {
          select: {
            id: true,
            name: true,
            year_id: true
          }
        },
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    const parsed = z.array(getGroupsSchema).parse(groups);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};