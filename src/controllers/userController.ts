import { Request, Response } from "express";
import {
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

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
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
          },
        },
      },
    });
    if (!user) return res.status(404).json({ ERROR: "Not Found" });
    const parsed = getAllUsersSchema.parse(user);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ERROR: "Validation failed" });
    }
    return res.status(400).json({ ERROR: err });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
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
      const field =
        existing.username === parsed.username ? "username" : "email";
      return res
        .status(409)
        .json({ error: `User with this ${field} already exists` });
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

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createStudent = async (req: Request, res: Response) => {
  try {
    const parsed = createStudentSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: parsed.username },
          ...(parsed.email ? [{ email: parsed.email }] : []),
        ],
      },
    });

    if (existing) {
      const field =
        existing.username === parsed.username ? "username" : "email";
      return res
        .status(409)
        .json({ error: `User with this ${field} already exists` });
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
          },
        },
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err });
    }
    console.error("Create student error:", err);
    return res.status(500).json({ error: err });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const parsed = updateUserSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (parsed.username) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          username: parsed.username,
          id: { not: userId },
        },
      });

      if (duplicateUser) {
        return res
          .status(409)
          .json({ error: "User with this username already exists" });
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
        return res
          .status(409)
          .json({ error: "User with this email already exists" });
      }
    }

    const dataToUpdate: {
      email?: string | null;
      username?: string;
      full_name?: string;
      phone_number?: string | null;
      role?: "ADMIN" | "DOCTOR" | "TEACHER" | "STUDENT";
      is_active?: boolean;
      password?: string;
      permissions?: string[];
    } = {};

    if (parsed.email !== undefined) dataToUpdate.email = parsed.email;
    if (parsed.username !== undefined) dataToUpdate.username = parsed.username;
    if (parsed.full_name !== undefined)
      dataToUpdate.full_name = parsed.full_name;
    if (parsed.phone_number !== undefined)
      dataToUpdate.phone_number = parsed.phone_number;
    if (parsed.role !== undefined) dataToUpdate.role = parsed.role;
    if (parsed.is_active !== undefined)
      dataToUpdate.is_active = parsed.is_active;
    if (parsed.permissions !== undefined)
      dataToUpdate.permissions = parsed.permissions;
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

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ Error: "User Not Found" });
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

    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(400).json({ Error: err });
  }
};
export const toggleUserActivity = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_active: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Toggle the is_active status
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
      message: `User ${updated.is_active ? "activated" : "deactivated"} successfully`,
      user: updated,
    });
  } catch (err) {
    console.error("Toggle user activity error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
export const updateStudent = async (req: Request, res: Response) => {
  try {
    // Validate request
    const validatedData = updateStudentSchema.parse({
      body: req.body,
      params: req.params,
    });

    const userId = validatedData.params.id;
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
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Prepare user update data
    const userUpdateData: any = {};
    if (body.full_name !== undefined) userUpdateData.full_name = body.full_name;
    if (body.email !== undefined) userUpdateData.email = body.email;
    if (body.username !== undefined) userUpdateData.username = body.username;
    if (body.phone_number !== undefined)
      userUpdateData.phone_number = body.phone_number;
    if (body.is_active !== undefined) userUpdateData.is_active = body.is_active;
    if (body.permissions !== undefined)
      userUpdateData.permissions = body.permissions;

    // Prepare student update data
    const studentUpdateData: any = {};
    if (body.student?.student_id !== undefined)
      studentUpdateData.student_id = body.student.student_id;
    if (body.student?.mother_name !== undefined)
      studentUpdateData.mother_name = body.student.mother_name;

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
            userId: true,
          },
        });
      } else if (
        Object.keys(studentUpdateData).length > 0 &&
        !existingUser.student
      ) {
        // Create student record if it doesn't exist
        student = await tx.student.create({
          data: {
            userId,
            student_id: studentUpdateData.rollN || 0,
            mother_name: studentUpdateData.mother_name || "",
          },
          select: {
            student_id: true,
            mother_name: true,
            userId: true,
          },
        });
      } else if (existingUser.student) {
        // Return existing student if no updates
        student = {
          student_id: existingUser.student.student_id,
          mother_name: existingUser.student.mother_name,
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
  } catch (error: any) {
    console.error("Update student error:", error);

    // Handle unique constraint errors
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    // Handle Zod validation errors
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
