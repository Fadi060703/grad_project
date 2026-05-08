// controllers/courses.ts

import { Request, Response } from "express";
import { createCourseSchema, getCoursesSchema, updateCourseSchema } from "../validators/courses";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';

export const getAllCourses = createListHandler({
  prisma: prisma.course,

  allowedSortFields: ["id", "name", "course_type", "exam_type", "theoretical_grade", "practical_grade", "created_at", "updated_at"],

  fieldTypes: {
    id: "number",
    name: "text",
    course_type: "text",
    exam_type: "text",
    theoretical_grade: "number",
    practical_grade: "number",
    majorId: "number",
    sectionId: "number",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["name"],

  findManyArgs: {
    select: {
      id: true,
      name: true,
      course_type: true,
      exam_type: true,
      theoretical_grade: true,
      practical_grade: true,
      majorId: true,
      sectionId: true,
      major: {
        select: {
          id: true,
          name: true,
          yearId: true,
          year: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      section: {
        select: {
          id: true,
          name: true,
          yearId: true,
          year: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      doctors: {
        select: {
          id: true,
          full_name: true,
          username: true,
          email: true,
        }
      },
      teachers: {
        select: {
          id: true,
          full_name: true,
          username: true,
          email: true,
        }
      },
      created_at: true,
      updated_at: true,
    },
  } as any,

  mapResult: ({ data }) => z.array(getCoursesSchema).parse(data),
});

export const getCourseById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        majorId: true,
        sectionId: true,
        major: {
          select: {
            id: true,
            name: true,
            yearId: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        section: {
          select: {
            id: true,
            name: true,
            yearId: true,
            year: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          }
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          }
        },
        created_at: true,
        updated_at: true,
      }
    });
    
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    
    // Transform to match frontend schema
    const transformed = {
      ...course,
      major_id: course.majorId,
      section_id: course.sectionId,
    };
    
    const parsed = getCoursesSchema.parse(transformed);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed"});
    }
    return res.status(400).json({ error: err });
  }
};

export const createCourse = async (req: Request, res: Response) => {
  try {
    const data = createCourseSchema.parse(req.body);
    
    // Validate that either major_id or section_id is provided
    if (!data.major_id && !data.section_id) {
      return res.status(400).json({ error: "Either major_id or section_id must be provided" });
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
    
    // Check if section exists (if provided)
    if (data.section_id) {
      const sectionExists = await prisma.section.findUnique({
        where: { id: data.section_id }
      });
      
      if (!sectionExists) {
        return res.status(404).json({ error: "Section not found" });
      }
    }
    
    // Validate teachers exist
    const teachers = await prisma.user.findMany({
      where: {
        id: { in: data.teachers_ids },
        role: "TEACHER"
      }
    });
    
    if (teachers.length !== data.teachers_ids.length) {
      return res.status(404).json({ error: "One or more teachers not found or have incorrect role" });
    }
    
    // Validate doctors exist
    const doctors = await prisma.user.findMany({
      where: {
        id: { in: data.doctors_ids },
        role: "DOCTOR"
      }
    });
    
    if (doctors.length !== data.doctors_ids.length) {
      return res.status(404).json({ error: "One or more doctors not found or have incorrect role" });
    }
    
    // Check for duplicate course
    const existing = await prisma.course.findFirst({
      where: {
        name: data.name,
        majorId: data.major_id || null,
        sectionId: data.section_id || null
      }
    });
    
    if (existing) {
      return res.status(409).json({ error: "Course with this name already exists for the selected major/section" });
    }
    
    const created = await prisma.course.create({
      data: {
        name: data.name,
        course_type: data.course_type,
        exam_type: data.exam_type,
        theoretical_grade: data.theoretical_grade,
        practical_grade: data.practical_grade,
        majorId: data.major_id || null,
        sectionId: data.section_id || null,
        doctors: {
          connect: data.doctors_ids.map(id => ({ id }))
        },
        teachers: {
          connect: data.teachers_ids.map(id => ({ id }))
        }
      },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        majorId: true,
        sectionId: true,
        major: {
          select: {
            id: true,
            name: true,
            yearId: true
          }
        },
        section: {
          select: {
            id: true,
            name: true,
            yearId: true
          }
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          }
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          }
        },
        created_at: true,
        updated_at: true,
      }
    });
    
    // Transform to match frontend schema
    const transformed = {
      ...created,
      major_id: created.majorId,
      section_id: created.sectionId,
    };
    
    return res.status(201).json(transformed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create course error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCourse = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateCourseSchema.parse(req.body);
    
    // Check if course exists
    const existingCourse = await prisma.course.findUnique({
      where: { id },
      include: {
        doctors: true,
        teachers: true
      }
    });
    
    if (!existingCourse) {
      return res.status(404).json({ error: "Course not found" });
    }
    
    // Validate major/section combination
    if (data.major_id !== undefined || data.section_id !== undefined) {
      const newMajorId = data.major_id !== undefined ? data.major_id : existingCourse.majorId;
      const newSectionId = data.section_id !== undefined ? data.section_id : existingCourse.sectionId;
      
      if (!newMajorId && !newSectionId) {
        return res.status(400).json({ error: "Either major_id or section_id must be provided" });
      }
      
      // Check if new major exists
      if (newMajorId) {
        const majorExists = await prisma.major.findUnique({
          where: { id: newMajorId }
        });
        
        if (!majorExists) {
          return res.status(404).json({ error: "Major not found" });
        }
      }
      
      // Check if new section exists
      if (newSectionId) {
        const sectionExists = await prisma.section.findUnique({
          where: { id: newSectionId }
        });
        
        if (!sectionExists) {
          return res.status(404).json({ error: "Section not found" });
        }
      }
    }
    
    // Validate and update teachers if provided
    if (data.teachers_ids) {
      const teachers = await prisma.user.findMany({
        where: {
          id: { in: data.teachers_ids },
          role: "TEACHER"
        }
      });
      
      if (teachers.length !== data.teachers_ids.length) {
        return res.status(404).json({ error: "One or more teachers not found or have incorrect role" });
      }
    }
    
    // Validate and update doctors if provided
    if (data.doctors_ids) {
      const doctors = await prisma.user.findMany({
        where: {
          id: { in: data.doctors_ids },
          role: "DOCTOR"
        }
      });
      
      if (doctors.length !== data.doctors_ids.length) {
        return res.status(404).json({ error: "One or more doctors not found or have incorrect role" });
      }
    }
    
    // Check for duplicate course name
    if (data.name || data.major_id !== undefined || data.section_id !== undefined) {
      const checkName = data.name !== undefined ? data.name : existingCourse.name;
      const checkMajorId = data.major_id !== undefined ? data.major_id : existingCourse.majorId;
      const checkSectionId = data.section_id !== undefined ? data.section_id : existingCourse.sectionId;
      
      const duplicate = await prisma.course.findFirst({
        where: {
          name: checkName,
          majorId: checkMajorId || null,
          sectionId: checkSectionId || null,
          id: { not: id }
        }
      });
      
      if (duplicate) {
        return res.status(409).json({ error: "Course with this name already exists for the selected major/section" });
      }
    }
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.course_type !== undefined) updateData.course_type = data.course_type;
    if (data.exam_type !== undefined) updateData.exam_type = data.exam_type;
    if (data.theoretical_grade !== undefined) updateData.theoretical_grade = data.theoretical_grade;
    if (data.practical_grade !== undefined) updateData.practical_grade = data.practical_grade;
    if (data.major_id !== undefined) updateData.majorId = data.major_id;
    if (data.section_id !== undefined) updateData.sectionId = data.section_id;
    
    // Handle relations
    if (data.teachers_ids) {
      updateData.teachers = {
        set: data.teachers_ids.map(id => ({ id }))
      };
    }
    
    if (data.doctors_ids) {
      updateData.doctors = {
        set: data.doctors_ids.map(id => ({ id }))
      };
    }
    
    const updated = await prisma.course.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        majorId: true,
        sectionId: true,
        major: {
          select: {
            id: true,
            name: true,
            yearId: true
          }
        },
        section: {
          select: {
            id: true,
            name: true,
            yearId: true
          }
        },
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          }
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
            email: true,
          }
        },
        created_at: true,
        updated_at: true,
      }
    });
    
    // Transform to match frontend schema
    const transformed = {
      ...updated,
      major_id: updated.majorId,
      section_id: updated.sectionId,
    };
    
    return res.status(200).json(transformed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed"});
    }
    console.error("Update course error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const existingCourse = await prisma.course.findUnique({
      where: { id }
    });
    
    if (!existingCourse) {
      return res.status(404).json({ error: "Course not found" });
    }
    
    const deleted = await prisma.course.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
      }
    });
    
    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete course error:", err);
    return res.status(400).json({ error: err });
  }
};

// Get courses by major
export const getCoursesByMajor = async (req: Request, res: Response) => {
  try {
    const majorId = parseInt(req.params.majorId, 10);
    
    const courses = await prisma.course.findMany({
      where: { majorId },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        sectionId: true,
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
          }
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
          }
        },
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    const transformed = courses.map(course => ({
      ...course,
      major_id: majorId,
      section_id: course.sectionId,
    }));
    
    const parsed = z.array(getCoursesSchema).parse(transformed);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed"});
    }
    return res.status(400).json({ error: err });
  }
};

// Get courses by section
export const getCoursesBySection = async (req: Request, res: Response) => {
  try {
    const sectionId = parseInt(req.params.sectionId, 10);
    
    const courses = await prisma.course.findMany({
      where: { sectionId },
      select: {
        id: true,
        name: true,
        course_type: true,
        exam_type: true,
        theoretical_grade: true,
        practical_grade: true,
        majorId: true,
        doctors: {
          select: {
            id: true,
            full_name: true,
            username: true,
          }
        },
        teachers: {
          select: {
            id: true,
            full_name: true,
            username: true,
          }
        },
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    const transformed = courses.map(course => ({
      ...course,
      major_id: course.majorId,
      section_id: sectionId,
    }));
    
    const parsed = z.array(getCoursesSchema).parse(transformed);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};