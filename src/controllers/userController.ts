import { Request, Response } from "express"
import { createUserSchema, getAllUsersrSchema, updateUserSchema } from "../validators/users";
import z from 'zod';
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import bcrypt from 'bcrypt';

export const getAllnonStudentUsers = createListHandler({
    prisma: prisma.user,
    allowedSortFields: ["id", "email", "userName", "role", "status"],
    // IMPORTANT: keys must be the *base* field names (before any dot)
    fieldTypes: {
        id: "number",        // change to "text" if your id is a string/uuid in Prisma
        email: "text",
        userName: "text",
        role: "text",
        status: "text",
    },
    searchableFields: ["email", "userName"],
    // Keep your existing select
    findManyArgs: {
        select: {
            id: true,
            email: true,
            userName: true,
            role: true,
            status: true,
        },
    } as any,
    // Hardcode your rule: role != STUDENT
    handleFindArgs: ({ findManyArgs }) => {
        const where = (findManyArgs as any).where || {};
        return {
            where: {
                ...where,
                role: { not: "STUDENT" },
            },
        } as any;
    },
    // Keep your Zod parsing
    mapResult: ({ data }) => z.array(getAllUsersrSchema).parse(data),
});

export const getAllStudentUsers = createListHandler({
    prisma: prisma.user,
    allowedSortFields: ["id", "email", "userName", "role", "status"],
    // IMPORTANT: keys must be the *base* field names (before any dot)
    fieldTypes: {
        id: "number",        // change to "text" if your id is a string/uuid in Prisma
        email: "text",
        userName: "text",
        role: "text",
        status: "text",
    },
    searchableFields: ["email", "userName"],
    // Keep your existing select
    findManyArgs: {
        select: {
            id: true,
            email: true,
            userName: true,
            role: true,
            status: true,
        },
    } as any,
    // Hardcode your rule: role != STUDENT
    handleFindArgs: ({ findManyArgs }) => {
        const where = (findManyArgs as any).where || {};
        return {
            where: {
                ...where,
                role: "STUDENT" ,
            },
        } as any;
    },
    // Keep your Zod parsing
    mapResult: ({ data }) => z.array(getAllUsersrSchema).parse(data),
});



export const getUserById = async (req: Request, res: Response) => {

    try {
        const id = parseInt(req.params.id, 10);
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ "ERROR": "Not Found" });
        const parsed = getAllUsersrSchema.parse(user);
        return res.status(200).json(parsed);
    }
    catch (err) {

        return res.status(400).json({ "ERROR": err });
    }

}


export const createUser = async (req: Request, res: Response) => {

    try {
        console.log('Available models:', Object.keys(prisma));
        const parsed = createUserSchema.parse(req.body);
        const existing = await prisma.user.findFirst({

            where: { userName: parsed.user_name }
        });
        console.log(" It exists ");

        if (existing) return res.status(409).json({ "error": "User wirh same credentials exist" });

        const hashedPassword = await bcrypt.hash(parsed.password, 10);
        const created = await prisma.user.create({
            data: {
                email: parsed.email || null,
                userName: parsed.user_name,
                role: parsed.role,
                status: parsed.status || true,
                password: hashedPassword
            }
        });
        return res.status(201).json(created);
    }

    catch (err) {

        return res.status(400).json({ "ERROR": err });

    }
}

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

        if (parsed.user_name) {
            const duplicateUser = await prisma.user.findFirst({
                where: {
                    userName: parsed.user_name,
                    id: { not: userId }
                }
            });

            if (duplicateUser) {
                return res.status(409).json({ "error": "User with same credentials exist" });
            }
        }

        const dataToUpdate: {
            email?: string | null;
            userName?: string;
            role?: "ADMIN" | "DOCTOR" | "TEACHER" | "STUDENT";
            status?: boolean;
            password?: string;
        } = {};

        if (parsed.email !== undefined) dataToUpdate.email = parsed.email;
        if (parsed.user_name !== undefined) dataToUpdate.userName = parsed.user_name;
        if (parsed.role !== undefined) dataToUpdate.role = parsed.role;
        if (parsed.status !== undefined) dataToUpdate.status = parsed.status;
        if (parsed.password !== undefined) {
            dataToUpdate.password = await bcrypt.hash(parsed.password, 10);
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate
        });

        return res.status(200).json(updated);
    }

    catch (err) {
        return res.status(400).json({ "ERROR": err });
    }
}

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
            where: { id: userId }
        });
        return res.status(200).json(deleted);
    }
    catch (err) {
        return res.status(400).json({ "Error": err });
    }
}