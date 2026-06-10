import { Router } from "express";
import { getAllPermissions, login, me } from "../controllers/auth/auth";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.get("/auth/permissions", getAllPermissions);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, me);

export default router;
