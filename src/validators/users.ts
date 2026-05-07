import { z } from "zod";

const studentSchema = z.object({
    rollNum: z.number(),
    userId: z.number(),
    mothersName: z.string(),
    phoneNumber: z.string(),
});

export const getAllUsersSchema = z.object({
    id: z.number(),
    email: z.string().optional().nullable(),
    username: z.string().min(3).max(20),  // Changed from userName to username
    full_name: z.string(),  // Added missing field
    phoneNumber: z.string().optional().nullable(),
    role: z.enum(['ADMIN', 'DOCTOR', 'TEACHER', 'STUDENT']),
    is_active: z.boolean(),  // Changed from status to is_active
    student: studentSchema.optional().nullable(),
    permissions: z.array(z.string()).default([]),  // Added permissions
    created_at: z.date(),  // Added timestamps
    updated_at: z.date(),  // Added timestamps
});

export const createUserSchema = z.object({
    email: z.string().email().optional().nullable(),
    username: z.string().min(3).max(20),
    full_name: z.string().min(2).max(100),
    phoneNumber: z.string().optional().nullable(),
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
    username: z.string().min(3).max(20),  // Changed from user_name to username
    full_name: z.string().min(2).max(100),  // Added full_name
    phoneNumber: z.string().optional().nullable(),  // User's phone
    role: z.enum(['STUDENT']),
    is_active: z.boolean().default(true).optional(),  // Changed from status to is_active
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(50, "Password must not exceed 50 characters")
        .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
        .regex(/[a-z]/, 'Must contain at least one Lowercase letter')
        .regex(/[0-9]/, "Must contain at least one number"),
    permissions: z.array(z.string()).default([]).optional(),  // Added permissions
    rollNum: z.number().positive(),
    mothersName: z.string(),
    mothersPhone: z.string(),  // Changed from phoneNumber to mothersPhone for clarity (since Student model has phoneNumber)
});

export const updateUserSchema = z.object({
    email: z.string().email().optional().nullable(),
    username: z.string().min(3).max(20).optional(),  // Changed from user_name to username
    full_name: z.string().min(2).max(100).optional(),  // Added full_name
    phoneNumber: z.string().optional().nullable(),
    role: z.enum(['ADMIN', 'DOCTOR', 'TEACHER', 'STUDENT']).optional(),
    is_active: z.boolean().optional(),  // Changed from status to is_active
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(50, "Password must not exceed 50 characters")
        .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
        .regex(/[a-z]/, 'Must contain at least one Lowercase letter')
        .regex(/[0-9]/, "Must contain at least one number")
        .optional(),
    permissions: z.array(z.string()).optional(),  // Added permissions
});

// Export types
export type getUsersDTO = z.infer<typeof getAllUsersSchema>;
export type createUserDTO = z.infer<typeof createUserSchema>;
export type createStudentDTO = z.infer<typeof createStudentSchema>;
export type updateUserDTO = z.infer<typeof updateUserSchema>;