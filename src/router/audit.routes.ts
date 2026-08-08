import { Router } from "express";
import { getAllAuditLogs } from "../controllers/auditLogController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get("/audit-log", authMiddleware, check("audit-logs:read"), getAllAuditLogs);

export default router;
