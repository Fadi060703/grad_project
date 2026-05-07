import { Request, Response } from "express"
import { createStudentSchema, createUserSchema, getAllUsersSchema, updateUserSchema } from "../validators/users";
import z from 'zod';
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import bcrypt from 'bcrypt';

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
            phoneNumber: true,
            role: true,
            is_active: true,
            permissions: true,
            created_at: true,
            updated_at: true,
            student: {
                select: {
                    rollNum: true,
                    mothersName: true,
                    phoneNumber: true
                }
            }
        },
    } as any,
    handleFindArgs: ({ findManyArgs }) => {
        const where = (findManyArgs as any).where || {};
        return {
            where: {
                ...where,
                role: { not: "STUDENT" },
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
            phoneNumber: true,
            role: true,
            is_active: true,
            permissions: true,
            created_at: true,
            updated_at: true,
            student: {
                select: {
                    rollNum: true,
                    mothersName: true,
                    phoneNumber: true
                }
            }
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
    mapResult: ({ data }) => z.array(getAllUsersSchema).parse(data),
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
                phoneNumber: true,
                role: true,
                is_active: true,
                permissions: true,
                created_at: true,
                updated_at: true,
                student: {
                    select: {
                        rollNum: true,
                        mothersName: true,
                        phoneNumber: true
                    }
                }
            }
        });
        if (!user) return res.status(404).json({ "ERROR": "Not Found" });
        const parsed = getAllUsersSchema.parse(user);
        return res.status(200).json(parsed);
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ "ERROR": "Validation failed" });
        }
        return res.status(400).json({ "ERROR": err });
    }
}

export const createUser = async (req: Request, res: Response) => {
    try {
        const parsed = createUserSchema.parse(req.body);
        
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: parsed.username },
                    ...(parsed.email ? [{ email: parsed.email }] : [])
                ]
            }
        });
        
        if (existing) {
            const field = existing.username === parsed.username ? 'username' : 'email';
            return res.status(409).json({ error: `User with this ${field} already exists` });
        }
        
        const hashedPassword = await bcrypt.hash(parsed.password, 10);
        
        const created = await prisma.user.create({
            data: {
                email: parsed.email || null,
                username: parsed.username,
                full_name: parsed.full_name,
                phoneNumber: parsed.phoneNumber || null,
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
                phoneNumber: true,
                role: true,
                is_active: true,
                created_at: true,
                updated_at: true,
                permissions: true,
            }
        });
        
        return res.status(201).json(created);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed' });
        }
        console.error('Create user error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const createStudent = async (req: Request, res: Response) => {
    try {
        const parsed = createStudentSchema.parse(req.body);
        
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: parsed.username },
                    ...(parsed.email ? [{ email: parsed.email }] : [])
                ]
            }
        });
        
        if (existing) {
            const field = existing.username === parsed.username ? 'username' : 'email';
            return res.status(409).json({ error: `User with this ${field} already exists` });
        }

        const hashedPassword = await bcrypt.hash(parsed.password, 10);
        
        const created = await prisma.user.create({
            data: {
                email: parsed.email || null,
                username: parsed.username,
                full_name: parsed.full_name,
                phoneNumber: parsed.phoneNumber || null,
                role: parsed.role,
                is_active: parsed.is_active ?? true,
                password: hashedPassword,
                permissions: parsed.permissions || [],
                student: {
                    create: {
                        rollNum: parsed.rollNum,
                        mothersName: parsed.mothersName,
                        phoneNumber: parsed.mothersPhone
                    }
                }
            },
            select: {
                id: true,
                email: true,
                username: true,
                full_name: true,
                phoneNumber: true,
                role: true,
                is_active: true,
                created_at: true,
                updated_at: true,
                permissions: true,
                student: {
                    select: {
                        rollNum: true,
                        mothersName: true,
                        phoneNumber: true
                    }
                }
            }
        });
        
        return res.status(201).json(created);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed' });
        }
        console.error('Create student error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const parsed = updateUserSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return res.status(404).json({ "error": "User not found" });
        }

        if (parsed.username) {
            const duplicateUser = await prisma.user.findFirst({
                where: {
                    username: parsed.username,
                    id: { not: userId }
                }
            });

            if (duplicateUser) {
                return res.status(409).json({ "error": "User with this username already exists" });
            }
        }

        if (parsed.email) {
            const duplicateEmail = await prisma.user.findFirst({
                where: {
                    email: parsed.email,
                    id: { not: userId }
                }
            });

            if (duplicateEmail) {
                return res.status(409).json({ "error": "User with this email already exists" });
            }
        }

        const dataToUpdate: {
            email?: string | null;
            username?: string;
            full_name?: string;
            phoneNumber?: string | null;
            role?: "ADMIN" | "DOCTOR" | "TEACHER" | "STUDENT";
            is_active?: boolean;
            password?: string;
            permissions?: string[];
        } = {};

        if (parsed.email !== undefined) dataToUpdate.email = parsed.email;
        if (parsed.username !== undefined) dataToUpdate.username = parsed.username;
        if (parsed.full_name !== undefined) dataToUpdate.full_name = parsed.full_name;
        if (parsed.phoneNumber !== undefined) dataToUpdate.phoneNumber = parsed.phoneNumber;
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
                phoneNumber: true,
                role: true,
                is_active: true,
                permissions: true,
                created_at: true,
                updated_at: true,
                student: {
                    select: {
                        rollNum: true,
                        mothersName: true,
                        phoneNumber: true
                    }
                }
            }
        });

        return res.status(200).json(updated);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed' });
        }
        console.error('Update user error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            return res.status(404).json({ "Error": "User Not Found" });
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
            }
        });
        
        return res.status(200).json(deleted);
    } catch (err) {
        console.error('Delete user error:', err);
        return res.status(400).json({ "Error": err });
    }
};