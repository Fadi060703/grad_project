// controllers/courses.ts

import { Request, Response } from "express";
import { createCourseSchema, getCoursesSchema, updateCourseSchema } from "../validators/courses";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod';
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";

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
    major_id: "number",
    section_id: "number",
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
      major_id: true,
      section_id: true,
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

export const getCourseById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid course ID');
  }
  
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      course_type: true,
      exam_type: true,
      theoretical_grade: true,
      practical_grade: true,
      major_id: true,
      section_id: true,
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
    throw new NotFoundError('Course');
  }
  
  // Transform to match frontend schema
  const transformed = {
    ...course,
    major_id: course.major_id,
    section_id: course.section_id,
  };
  
  const parsed = getCoursesSchema.parse(transformed);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const data = createCourseSchema.parse(req.body);
  
  // Validate that either major_id or section_id is provided
  if (!data.major_id && !data.section_id) {
    throw new BadRequestError('Either major_id or section_id must be provided');
  }
  
  // Check if major exists (if provided)
  if (data.major_id) {
    const majorExists = await prisma.major.findUnique({
      where: { id: data.major_id }
    });
    
    if (!majorExists) {
      throw new NotFoundError('Major');
    }
  }
  
  // Check if section exists (if provided)
  if (data.section_id) {
    const sectionExists = await prisma.section.findUnique({
      where: { id: data.section_id }
    });
    
    if (!sectionExists) {
      throw new NotFoundError('Section');
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
    throw new NotFoundError('One or more teachers not found or have incorrect role');
  }
  
  // Validate doctors exist
  const doctors = await prisma.user.findMany({
    where: {
      id: { in: data.doctors_ids },
      role: "DOCTOR"
    }
  });
  
  if (doctors.length !== data.doctors_ids.length) {
    throw new NotFoundError('One or more doctors not found or have incorrect role');
  }
  
  // Check for duplicate course
  const existing = await prisma.course.findFirst({
    where: {
      name: data.name,
      major_id: data.major_id || null,
      section_id: data.section_id || null
    }
  });
  
  if (existing) {
    throw new ConflictError('Course with this name already exists for the selected major/section');
  }
  
  const created = await prisma.course.create({
    data: {
      name: data.name,
      course_type: data.course_type,
      exam_type: data.exam_type,
      theoretical_grade: data.theoretical_grade,
      practical_grade: data.practical_grade,
      major_id: data.major_id || null,
      section_id: data.section_id || null,
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
      major_id: true,
      section_id: true,
      major: {
        select: {
          id: true,
          name: true,
          year_id: true
        }
      },
      section: {
        select: {
          id: true,
          name: true,
          year_id: true
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
    major_id: created.major_id,
    section_id: created.section_id,
  };
  
  return res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: transformed
  });
});

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid course ID');
  }
  
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
    throw new NotFoundError('Course');
  }
  
  // Validate major/section combination
  if (data.major_id !== undefined || data.section_id !== undefined) {
    const newMajorId = data.major_id !== undefined ? data.major_id : existingCourse.major_id;
    const newSectionId = data.section_id !== undefined ? data.section_id : existingCourse.section_id;
    
    if (!newMajorId && !newSectionId) {
      throw new BadRequestError('Either major_id or section_id must be provided');
    }
    
    // Check if new major exists
    if (newMajorId) {
      const majorExists = await prisma.major.findUnique({
        where: { id: newMajorId }
      });
      
      if (!majorExists) {
        throw new NotFoundError('Major');
      }
    }
    
    // Check if new section exists
    if (newSectionId) {
      const sectionExists = await prisma.section.findUnique({
        where: { id: newSectionId }
      });
      
      if (!sectionExists) {
        throw new NotFoundError('Section');
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
      throw new NotFoundError('One or more teachers not found or have incorrect role');
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
      throw new NotFoundError('One or more doctors not found or have incorrect role');
    }
  }
  
  // Check for duplicate course name
  if (data.name || data.major_id !== undefined || data.section_id !== undefined) {
    const checkName = data.name !== undefined ? data.name : existingCourse.name;
    const checkMajorId = data.major_id !== undefined ? data.major_id : existingCourse.major_id;
    const checkSectionId = data.section_id !== undefined ? data.section_id : existingCourse.section_id;
    
    const duplicate = await prisma.course.findFirst({
      where: {
        name: checkName,
        major_id: checkMajorId || null,
        section_id: checkSectionId || null,
        id: { not: id }
      }
    });
    
    if (duplicate) {
      throw new ConflictError('Course with this name already exists for the selected major/section');
    }
  }
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.course_type !== undefined) updateData.course_type = data.course_type;
  if (data.exam_type !== undefined) updateData.exam_type = data.exam_type;
  if (data.theoretical_grade !== undefined) updateData.theoretical_grade = data.theoretical_grade;
  if (data.practical_grade !== undefined) updateData.practical_grade = data.practical_grade;
  if (data.major_id !== undefined) updateData.major_id = data.major_id;
  if (data.section_id !== undefined) updateData.section_id = data.section_id;
  
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
      major_id: true,
      section_id: true,
      major: {
        select: {
          id: true,
          name: true,
          year_id: true
        }
      },
      section: {
        select: {
          id: true,
          name: true,
          year_id: true
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
    major_id: updated.major_id,
    section_id: updated.section_id,
  };
  
  return res.status(200).json({
    success: true,
    message: 'Course updated successfully',
    data: transformed
  });
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid course ID');
  }
  
  const existingCourse = await prisma.course.findUnique({
    where: { id }
  });
  
  if (!existingCourse) {
    throw new NotFoundError('Course');
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
  
  return res.status(200).json({
    success: true,
    message: 'Course deleted successfully',
    data: deleted
  });
});

// Get courses by major
export const getCoursesByMajor = asyncHandler(async (req: Request, res: Response) => {
  const major_id = parseInt(req.params.major_id as string, 10);
  
  if (isNaN(major_id)) {
    throw new BadRequestError('Invalid major ID');
  }
  
  const courses = await prisma.course.findMany({
    where: { major_id },
    select: {
      id: true,
      name: true,
      course_type: true,
      exam_type: true,
      theoretical_grade: true,
      practical_grade: true,
      section_id: true,
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
    major_id: major_id,
    section_id: course.section_id,
  }));
  
  const parsed = z.array(getCoursesSchema).parse(transformed);
  
  return res.status(200).json({
    success: true,
    data: parsed,
    count: parsed.length
  });
});

// Get courses by section
export const getCoursesBySection = asyncHandler(async (req: Request, res: Response) => {
  const section_id = parseInt(req.params.section_id as string, 10);
  
  if (isNaN(section_id)) {
    throw new BadRequestError('Invalid section ID');
  }
  
  const courses = await prisma.course.findMany({
    where: { section_id },
    select: {
      id: true,
      name: true,
      course_type: true,
      exam_type: true,
      theoretical_grade: true,
      practical_grade: true,
      major_id: true,
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
    major_id: course.major_id,
    section_id: section_id,
  }));
  
  const parsed = z.array(getCoursesSchema).parse(transformed);
  
  return res.status(200).json({
    success: true,
    data: parsed,
    count: parsed.length
  });
});