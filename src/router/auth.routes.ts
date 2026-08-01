import { Router } from "express";
import { changeDashboardPassword, getAllPermissions, login, me } from "../controllers/auth/auth";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.get("/auth/permissions", getAllPermissions);
router.post("/auth/login", login);
router.put("/auth/change-password", authMiddleware, changeDashboardPassword);
router.get("/auth/me", authMiddleware, me);
router.get("", authMiddleware, me);

export default router;
