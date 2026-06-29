// controllers/users.ts

import { Request, Response } from "express";
import {
  bulkCreateStudentsSchema,
  createStudentSchema,
  createUserSchema,
  getAllStudentsSchema,
  getAllUsersSchema,
  updateStudentSchema,
  updateUserSchema,
} from "../validators/users";
import z from "zod";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import bcrypt from "bcrypt";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError, ConflictError } from "../errors";

export const getAllnonStudentUsers = createListHandler({
  prisma: prisma.user,
  allowedSortFields: ["id", "email", "username", "role", "is_active"],
  fieldTypes: {
    id: "number",
    email: "text",
    username: "text",
    role: "text",
    is_active: "text",
  },
  searchableFields: ["email", "username"],
  findManyArgs: {
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      phone_number: true,
      role: true,
      is_active: true,
      permissions: true,
      created_at: true,
      updated_at: true,
    },
  } as any,
  handleFindArgs: ({ findManyArgs }) => {
    const where = (findManyArgs as any).where || {};
    return {
      where: {
        AND: [where, { role: { not: "STUDENT" } }],
      },
    } as any;
  },
  mapResult: ({ data }) => z.array(getAllUsersSchema).parse(data),
});

export const getAllStudentUsers = createListHandler({
  prisma: prisma.user,
  allowedSortFields: ["id", "email", "username", "role", "is_active"],
  fieldTypes: {
    id: "number",
    email: "text",
    username: "text",
    role: "text",
    is_active: "text",
  },
  searchableFields: ["email", "username"],
  findManyArgs: {
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      phone_number: true,
      role: true,
      is_active: true,
      permissions: true,
      created_at: true,
      updated_at: true,
      student: {
        select: {
          student_id: true,
          mother_name: true,
          year_id: true,
          section_id: true,
          major_id: true,
          group_id: true,
        },
      },
    },
  } as any,
  handleFindArgs: ({ findManyArgs }) => {
    const where = (findManyArgs as any).where || {};
    return {
      where: {
        ...where,
        role: "STUDENT",
      },
    } as any;
  },
  mapResult: ({ data }) => z.array(getAllStudentsSchema).parse(data),
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid user ID');
  }
  
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      phone_number: true,
      role: true,
      is_active: true,
      permissions: true,
      created_at: true,
      updated_at: true,
      student: {
        select: {
          student_id: true,
          mother_name: true,
          year_id: true,
          section_id: true,
          major_id: true,
          group_id: true,
        },
      },
    },
  });
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  const parsed = getAllUsersSchema.parse(user);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createUserSchema.parse(req.body);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: parsed.username },
        ...(parsed.email ? [{ email: parsed.email }] : []),
      ],
    },
  });

  if (existing) {
    const field = existing.username === parsed.username ? "username" : "email";
    throw new ConflictError(`User with this ${field} already exists`);
  }

  const hashedPassword = await bcrypt.hash(parsed.password, 10);

  const created = await prisma.user.create({
    data: {
      email: parsed.email || null,
      username: parsed.username,
      full_name: parsed.full_name,
      phone_number: parsed.phone_number || null,
      role: parsed.role,
      is_active: parsed.is_active ?? true,
      password: hashedPassword,
      permissions: parsed.permissions || [],
    },
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      phone_number: true,
      role: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      permissions: true,
    },
  });

  return res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: created
  });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createStudentSchema.parse(req.body);

  // Validate that either section_id OR major_id is provided (not both)
  if (parsed.section_id && parsed.major_id) {
    throw new BadRequestError('Provide either section_id or major_id, not both');
  }
  
  if (!parsed.section_id && !parsed.major_id) {
    throw new BadRequestError('Either section_id or major_id must be provided');
  }

  // Check if user exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: parsed.username },
        ...(parsed.email ? [{ email: parsed.email }] : []),
      ],
    },
  });

  if (existing) {
    const field = existing.username === parsed.username ? "username" : "email";
    throw new ConflictError(`User with this ${field} already exists`);
  }

  // Verify year exists
  const yearExists = await prisma.year.findUnique({
    where: { id: parsed.year_id }
  });
  
  if (!yearExists) {
    throw new NotFoundError('Year');
  }

  // Verify group exists
  const groupExists = await prisma.group.findUnique({
    where: { id: parsed.group_id }
  });
  
  if (!groupExists) {
    throw new NotFoundError('Group');
  }

  // Verify section exists if provided
  if (parsed.section_id) {
    const sectionExists = await prisma.section.findUnique({
      where: { id: parsed.section_id }
    });
    
    if (!sectionExists) {
      throw new NotFoundError('Section');
    }
  }

  // Verify major exists if provided
  if (parsed.major_id) {
    const majorExists = await prisma.major.findUnique({
      where: { id: parsed.major_id }
    });
    
    if (!majorExists) {
      throw new NotFoundError('Major');
    }
  }

  const hashedPassword = await bcrypt.hash(parsed.password, 10);

  const created = await prisma.user.create({
    data: {
      email: parsed.email || null,
      username: parsed.username,
      full_name: parsed.full_name,
      phone_number: parsed.phone_number || null,
      role: parsed.role,
      is_active: parsed.is_active ?? true,
      password: hashedPassword,
      permissions: parsed.permissions || [],
      student: {
        create: {
          student_id: parsed.student_id,
          mother_name: parsed.mother_name,
          year_id: parsed.year_id,
          section_id: parsed.section_id || null,
          major_id: parsed.major_id || null,
          group_id: parsed.group_id,
        },
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      phone_number: true,
      role: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      permissions: true,
      student: {
        select: {
          student_id: true,
          mother_name: true,
          year_id: true,
          section_id: true,
          major_id: true,
          group_id: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    message: 'Student created successfully',
    data: created
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  
  if (isNaN(userId)) {
    throw new BadRequestError('Invalid user ID');
  }
  
  const parsed = updateUserSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new NotFoundError('User');
  }

  if (parsed.username) {
    const duplicateUser = await prisma.user.findFirst({
      where: {
        username: parsed.username,
        id: { not: userId },
      },
    });

    if (duplicateUser) {
      throw new ConflictError('User with this username already exists');
    }
  }

  if (parsed.email) {
    const duplicateEmail = await prisma.user.findFirst({
      where: {
        email: parsed.email,
        id: { not: userId },
      },
    });

    if (duplicateEmail) {
      throw new ConflictError('User with this email already exists');
    }
  }

  const dataToUpdate: {
    email?: string | null;
    username?: string;
    full_name?: string;
    phone_number?: string | null;
    role?: "ADMIN" | "DOCTOR" | "TEACHER" | "STUDENT" | "CONTENT_DE" | "EXAMS_DE" | "LECTURES_SCHEDULE_DE" | "MARKS_DE";
    is_active?: boolean;
    password?: string;
    permissions?: string[];
  } = {};

  if (parsed.email !== undefined) dataToUpdate.email = parsed.email;
  if (parsed.username !== undefined) dataToUpdate.username = parsed.username;
  if (parsed.full_name !== undefined) dataToUpdate.full_name = parsed.full_name;
  if (parsed.phone_number !== undefined) dataToUpdate.phone_number = parsed.phone_number;
  if (parsed.role !== undefined) dataToUpdate.role = parsed.role;
  if (parsed.is_active !== undefined) dataToUpdate.is_active = parsed.is_active;
  if (parsed.permissions !== undefined) dataToUpdate.permissions = parsed.permissions;
  if (parsed.password !== undefined) {
    dataToUpdate.password = await bcrypt.hash(parsed.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      phone_number: true,
      role: true,
      is_active: true,
      permissions: true,
      created_at: true,
      updated_at: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: updated
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  
  if (isNaN(userId)) {
    throw new BadRequestError('Invalid user ID');
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  const deleted = await prisma.user.delete({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      role: true,
      is_active: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'User deleted successfully',
    data: deleted
  });
});

export const toggleUserActivity = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  
  if (isNaN(userId)) {
    throw new BadRequestError('Invalid user ID');
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { is_active: true },
  });

  if (!existingUser) {
    throw new NotFoundError('User');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { is_active: !existingUser.is_active },
    select: {
      id: true,
      email: true,
      username: true,
      full_name: true,
      role: true,
      is_active: true,
      updated_at: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: `User ${updated.is_active ? "activated" : "deactivated"} successfully`,
    data: updated
  });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  
  if (isNaN(userId)) {
    throw new BadRequestError('Invalid student ID');
  }

  const validatedData = updateStudentSchema.parse({
    body: req.body,
    params: req.params,
  });

  const { body } = validatedData;

  // Check if user exists and is a student
  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      role: "STUDENT",
    },
    include: {
      student: true,
    },
  });

  if (!existingUser) {
    throw new NotFoundError('Student');
  }

  // Validate section/major mutual exclusivity if both are provided
  if (body.student?.section_id && body.student?.major_id) {
    throw new BadRequestError('Provide either section_id or major_id, not both');
  }

  // Prepare user update data
  const userUpdateData: any = {};
  if (body.full_name !== undefined) userUpdateData.full_name = body.full_name;
  if (body.email !== undefined) userUpdateData.email = body.email;
  if (body.username !== undefined) userUpdateData.username = body.username;
  if (body.phone_number !== undefined) userUpdateData.phone_number = body.phone_number;
  if (body.is_active !== undefined) userUpdateData.is_active = body.is_active;
  if (body.permissions !== undefined) userUpdateData.permissions = body.permissions;

  // Prepare student update data
  const studentUpdateData: any = {};
  if (body.student?.student_id !== undefined) studentUpdateData.student_id = body.student.student_id;
  if (body.student?.mother_name !== undefined) studentUpdateData.mother_name = body.student.mother_name;
  if (body.student?.year_id !== undefined) studentUpdateData.year_id = body.student.year_id;
  if (body.student?.section_id !== undefined) studentUpdateData.section_id = body.student.section_id;
  if (body.student?.major_id !== undefined) studentUpdateData.major_id = body.student.major_id;
  if (body.student?.group_id !== undefined) studentUpdateData.group_id = body.student.group_id;

  // Verify related entities if being updated
  if (studentUpdateData.year_id) {
    const yearExists = await prisma.year.findUnique({
      where: { id: studentUpdateData.year_id }
    });
    if (!yearExists) throw new NotFoundError('Year');
  }

  if (studentUpdateData.group_id) {
    const groupExists = await prisma.group.findUnique({
      where: { id: studentUpdateData.group_id }
    });
    if (!groupExists) throw new NotFoundError('Group');
  }

  if (studentUpdateData.section_id) {
    const sectionExists = await prisma.section.findUnique({
      where: { id: studentUpdateData.section_id }
    });
    if (!sectionExists) throw new NotFoundError('Section');
  }

  if (studentUpdateData.major_id) {
    const majorExists = await prisma.major.findUnique({
      where: { id: studentUpdateData.major_id }
    });
    if (!majorExists) throw new NotFoundError('Major');
  }

  // Update user and student in a transaction
  const updatedStudent = await prisma.$transaction(async (tx) => {
    // Update user
    const user = await tx.user.update({
      where: { id: userId },
      data: userUpdateData,
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        phone_number: true,
        role: true,
        is_active: true,
        permissions: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Update student if there's student data
    let student = null;
    if (Object.keys(studentUpdateData).length > 0 && existingUser.student) {
      student = await tx.student.update({
        where: { userId },
        data: studentUpdateData,
        select: {
          student_id: true,
          mother_name: true,
          year_id: true,
          section_id: true,
          major_id: true,
          group_id: true,
          userId: true,
        },
      });
    } else if (Object.keys(studentUpdateData).length > 0 && !existingUser.student) {
      // Create student record if it doesn't exist
      student = await tx.student.create({
        data: {
          userId,
          student_id: studentUpdateData.student_id || 0,
          mother_name: studentUpdateData.mother_name || "",
          year_id: studentUpdateData.year_id,
          section_id: studentUpdateData.section_id || null,
          major_id: studentUpdateData.major_id || null,
          group_id: studentUpdateData.group_id,
        },
        select: {
          student_id: true,
          mother_name: true,
          year_id: true,
          section_id: true,
          major_id: true,
          group_id: true,
          userId: true,
        },
      });
    } else if (existingUser.student) {
      // Return existing student if no updates
      student = {
        student_id: existingUser.student.student_id,
        mother_name: existingUser.student.mother_name,
        year_id: existingUser.student.year_id,
        section_id: existingUser.student.section_id,
        major_id: existingUser.student.major_id,
        group_id: existingUser.student.group_id,
        userId: existingUser.student.userId,
      };
    }

    return { user, student };
  });

  return res.status(200).json({
    success: true,
    message: "Student updated successfully",
    data: {
      ...updatedStudent.user,
      student: updatedStudent.student,
    },
  });
});

export const bulkCreateStudents = asyncHandler(async (req: Request, res: Response) => {
  const raw = bulkCreateStudentsSchema.parse(req.body);

  // Deduplicate by username, keep first occurrence
  const seen = new Set<string>();
  const students = raw.filter((s) => {
    if (seen.has(s.username)) return false;
    seen.add(s.username);
    return true;
  });

  // Validate section/major mutual exclusivity for each entry
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    if (s.section_id && s.major_id) {
      throw new BadRequestError(`Student at index ${i} (username: ${s.username}): provide either section_id or major_id, not both`);
    }
    if (!s.section_id && !s.major_id) {
      throw new BadRequestError(`Student at index ${i} (username: ${s.username}): either section_id or major_id must be provided`);
    }
  }

  // Check for duplicate usernames in DB
  const usernames = students.map((s) => s.username);
  const emails = students.filter((s) => s.email).map((s) => s.email as string);

  const existingUsers = await prisma.user.findMany({
    where: {
      OR: [
        { username: { in: usernames } },
        ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
      ],
    },
    select: { username: true, email: true },
  });

  if (existingUsers.length > 0) {
    const conflictUsernames = existingUsers.map((u) => u.username).filter(Boolean);
    const conflictEmails = existingUsers.map((u) => u.email).filter(Boolean);
    throw new ConflictError(
      `The following already exist — usernames: [${conflictUsernames.join(", ")}]${conflictEmails.length > 0 ? `, emails: [${conflictEmails.join(", ")}]` : ""}`
    );
  }

  // Validate all related entity IDs exist
  const yearIds = [...new Set(students.map((s) => s.year_id))];
  const groupIds = [...new Set(students.map((s) => s.group_id))];
  const sectionIds = [...new Set(students.filter((s) => s.section_id).map((s) => s.section_id as number))];
  const majorIds = [...new Set(students.filter((s) => s.major_id).map((s) => s.major_id as number))];

  const [years, groups, sections, majors] = await Promise.all([
    prisma.year.findMany({ where: { id: { in: yearIds } }, select: { id: true } }),
    prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true } }),
    sectionIds.length > 0
      ? prisma.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true } })
      : Promise.resolve([]),
    majorIds.length > 0
      ? prisma.major.findMany({ where: { id: { in: majorIds } }, select: { id: true } })
      : Promise.resolve([]),
  ]);

  const foundYearIds = new Set(years.map((y) => y.id));
  const foundGroupIds = new Set(groups.map((g) => g.id));
  const foundSectionIds = new Set(sections.map((s) => s.id));
  const foundMajorIds = new Set(majors.map((m) => m.id));

  const missingYears = yearIds.filter((id) => !foundYearIds.has(id));
  const missingGroups = groupIds.filter((id) => !foundGroupIds.has(id));
  const missingSections = sectionIds.filter((id) => !foundSectionIds.has(id));
  const missingMajors = majorIds.filter((id) => !foundMajorIds.has(id));

  if (missingYears.length > 0) throw new NotFoundError(`Years with IDs: [${missingYears.join(", ")}]`);
  if (missingGroups.length > 0) throw new NotFoundError(`Groups with IDs: [${missingGroups.join(", ")}]`);
  if (missingSections.length > 0) throw new NotFoundError(`Sections with IDs: [${missingSections.join(", ")}]`);
  if (missingMajors.length > 0) throw new NotFoundError(`Majors with IDs: [${missingMajors.join(", ")}]`);

  // Hash all passwords
  const hashed = await Promise.all(students.map((s) => bcrypt.hash(s.password, 10)));

  // Create all in one transaction
  await prisma.$transaction(
    students.map((s, i) =>
      prisma.user.create({
        data: {
          email: s.email || null,
          username: s.username,
          full_name: s.full_name,
          phone_number: s.phone_number || null,
          role: s.role,
          is_active: s.is_active ?? true,
          password: hashed[i],
          permissions: s.permissions || [],
          student: {
            create: {
              student_id: s.student_id,
              mother_name: s.mother_name,
              year_id: s.year_id,
              section_id: s.section_id || null,
              major_id: s.major_id || null,
              group_id: s.group_id,
            },
          },
        },
      })
    )
  );

  return res.status(201).json({
    success: true,
    count: students.length,
    message: "Students created successfully",
  });
});