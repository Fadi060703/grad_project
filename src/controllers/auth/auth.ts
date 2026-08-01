import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { loginSchema } from "../../validators/login";
import { changeDashboardPasswordSchema } from "../../validators/auth-change-password";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../../config/auth";
import { permissions, Role } from "../../lib/permissions";
import { asyncHandler } from "../../utils/asyncHandler";
import { BadRequestError, UnauthorizedError, NotFoundError, ForbiddenError } from "../../errors";

export const login = asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username: data.userName } });
    if (!user) throw new BadRequestError("Wrong Credentials");

    const matched = await bcrypt.compare(data.password, user.password);
    if (!matched) throw new BadRequestError("Wrong Password");

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });

    return res.status(200).json({
        success: true,
        data: { access: token, expires_in: JWT_EXPIRES_IN },
    });
});

export const changeDashboardPassword = asyncHandler(async (req: Request, res: Response) => {
    const data = changeDashboardPasswordSchema.parse(req.body);
    const { id } = req.user as { id: number | string; role: string };
    const userId = Number(id);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, password: true },
    });

    if (!user) throw new NotFoundError("User");
    if (user.role === "STUDENT") {
        throw new ForbiddenError("Students cannot use dashboard password change");
    }

    const matched = await bcrypt.compare(data.current_password, user.password);
    if (!matched) throw new BadRequestError("Current password is incorrect");

    const hashedPassword = await bcrypt.hash(data.new_password, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
    });

    return res.status(200).json({
        success: true,
        message: "Password changed successfully",
    });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new UnauthorizedError("No token provided");

    let decoded: { id: string; role: string };
    try {
        decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    } catch {
        throw new UnauthorizedError("Token is invalid or expired");
    }

    const user = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: { id: true, username: true, email: true, role: true, is_active: true },
    });

    if (!user) throw new NotFoundError("User");

    return res.status(200).json({
        success: true,
        data: {
            ...user,
            permissions: permissions[user.role as Role] ?? [],
        },
    });
});


// TODO: we can later implement token blacklisting to invalidate tokens on logout

// export const logout = asyncHandler(async (_req: Request, res: Response) => {
//     return res.status(200).json({ success: true, message: "Logged out successfully" });
// });

export const getAllPermissions = asyncHandler(async (_req: Request, res: Response) => {
    const unique = [...new Set(Object.values(permissions).flat())];

    return res.status(200).json({ success: true, data: unique });
});