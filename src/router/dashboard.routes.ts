import { Router } from "express";
import {
  getAdminDashboard,
  getContentDeDashboard,
  getDoctorDashboard,
  getExamsDeDashboard,
  getLecturesScheduleDeDashboard,
  getTeacherDashboard,
} from "../controllers/dashboardController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get(
  "/dashboard/admin",
  authMiddleware,
  check("admin-dashboard:read"),
  getAdminDashboard,
);

router.get(
  "/dashboard/doctor",
  authMiddleware,
  check("doctor-dashboard:read"),
  getDoctorDashboard,
);

router.get(
  "/dashboard/teacher",
  authMiddleware,
  check("teacher-dashboard:read"),
  getTeacherDashboard,
);

router.get(
  "/dashboard/content-de",
  authMiddleware,
  check("content-dashboard:read"),
  getContentDeDashboard,
);

router.get(
  "/dashboard/exams-de",
  authMiddleware,
  check("exams-dashboard:read"),
  getExamsDeDashboard,
);

router.get(
  "/dashboard/lectures-schedule-de",
  authMiddleware,
  check("lectures-schedule-dashboard:read"),
  getLecturesScheduleDeDashboard,
);

export default router;
