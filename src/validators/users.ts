// validators/users.ts

import { z } from "zod";

const studentSchema = z.object({
    student_id: z.number(),
    mother_name: z.string(),
    year_id: z.number().positive(),
    section_id: z.number().positive().optional().nullable(),
    major_id: z.number().positive().optional().nullable(),
    group_id: z.number().positive(),
});

export const getAllUsersSchema = z.object({
    id: z.number(),
    email: z.string().optional().nullable(),
    username: z.string().min(3).max(20),
    full_name: z.string(),
    phone_number: z.string().optional().nullable(),
    role: z.enum(['ADMIN', 'DOCTOR', 'TEACHER', 'STUDENT']),
    is_active: z.boolean(),
    student: studentSchema.optional().nullable(),
    permissions: z.array(z.string()).default([]),
    created_at: z.date(),
    updated_at: z.date(),
});

export const getAllStudentsSchema = z.object({
  id: z.number(),
  email: z.string().nullable(),
  username: z.string(),
  full_name: z.string(),
  phone_number: z.string().nullable(),
  role: z.enum(["STUDENT", "TEACHER", "ADMIN"]),
  is_active: z.boolean(),
  permissions: z.array(z.string()),
  created_at: z.date(),
  updated_at: z.date(),
  student: studentSchema,
});

export const createUserSchema = z.object({
    email: z.string().email().optional().nullable(),
    username: z.string().min(3).max(20),
    full_name: z.string().min(2).max(100),
    phone_number: z.string().optional().nullable(),
    role: z.enum(['ADMIN', 'DOCTOR', 'TEACHER', 'STUDENT']),
    is_active: z.boolean().default(true).optional(),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(50, "Password must not exceed 50 characters")
        .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
        .regex(/[a-z]/, "Must contain at least one Lowercase letter")
        .regex(/[0-9]/, "Must contain at least one number"),
    permissions: z.array(z.string()).default([]).optional(),
});

export const createStudentSchema = z.object({
    email: z.string().email().optional().nullable(),
    username: z.string().min(3).max(20),
    full_name: z.string().min(2).max(100),
    phone_number: z.string().optional().nullable(),
    role: z.enum(['STUDENT']),
    is_active: z.boolean().default(true).optional(),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(50, "Password must not exceed 50 characters")
        .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
        .regex(/[a-z]/, 'Must contain at least one Lowercase letter')
        .regex(/[0-9]/, "Must contain at least one number"),
    permissions: z.array(z.string()).default([]).optional(),
    student_id: z.coerce.number().positive(),
    mother_name: z.string(),
    year_id: z.number().positive(),
    section_id: z.number().positive().optional().nullable(),
    major_id: z.number().positive().optional().nullable(),
    group_id: z.number().positive(),
});

export const updateUserSchema = z.object({
    email: z.string().email().optional().nullable(),
    username: z.string().min(3).max(20).optional(),
    full_name: z.string().min(2).max(100).optional(),
    phone_number: z.string().optional().nullable(),
    role: z.enum(['ADMIN', 'DOCTOR', 'TEACHER', 'STUDENT']).optional(),
    is_active: z.boolean().optional(),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(50, "Password must not exceed 50 characters")
        .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
        .regex(/[a-z]/, 'Must contain at least one Lowercase letter')
        .regex(/[0-9]/, "Must contain at least one number")
        .optional(),
    permissions: z.array(z.string()).optional(),
});

export const updateStudentSchema = z.object({
  body: z.object({
    full_name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    phone_number: z.string().optional(),
    is_active: z.boolean().optional(),
    student: z.object({
      student_id: z.number().optional(),
      mother_name: z.string().optional(),
      year_id: z.number().positive().optional(),
      section_id: z.number().positive().optional().nullable(),
      major_id: z.number().positive().optional().nullable(),
      group_id: z.number().positive().optional(),
    }).optional(),
    permissions: z.array(z.string()).optional(),
  }),
  params: z.object({
    id: z.string().transform(Number),
  }),
});

// Export types
export type getUsersDTO = z.infer<typeof getAllUsersSchema>;
export type createUserDTO = z.infer<typeof createUserSchema>;
export type createStudentDTO = z.infer<typeof createStudentSchema>;
export type updateUserDTO = z.infer<typeof updateUserSchema>;
export type updateStudentDTO = z.infer<typeof updateStudentSchema>;