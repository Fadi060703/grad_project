import { NextFunction, Request, Response } from "express";
import { permissions, Role } from "../lib/permissions";

export const check = (required: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user)
      return res.status(403).json({ message: "UNAUTHORIZED Or Don't Have Permission" });

    const rolePermissions = permissions[user.role as Role];

    const requiredPermissions = Array.isArray(required) ? required : [required];

    const hasPermission = requiredPermissions.some((perm) =>
      rolePermissions?.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "UNAUTHORIZED Or Don't Have Permission" });
    }

    next();
  };
};