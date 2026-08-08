import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import academicRoutes from "./academic.routes";
import courseRoutes from "./course.routes";
import lectureRoutes from "./lecture.routes";
import examRoutes from "./exam.routes";
import contentRoutes from "./content.routes";
import systemRoutes from "./system.routes";
import studentRoutes from "./student.routes";
import timeConditionedRoutes from "./timeConditioned.routes";
import notificationRoutes from "./notifications.routes";
import dashboardRoutes from "./dashboard.routes";
import aiRoutes from "./ai.routes";
import surveyRoutes from "./survey.routes";
import auditRoutes from "./audit.routes";
import actionsRoutes from "./actions.routes";

const router = Router();

router.use("/", authRoutes);
router.use("/", userRoutes);
router.use("/", academicRoutes);
router.use("/", courseRoutes);
router.use("/", lectureRoutes);
router.use("/", examRoutes);
router.use("/", contentRoutes);
router.use("/", systemRoutes);
router.use("/", studentRoutes);
router.use("/", timeConditionedRoutes);
router.use("/", notificationRoutes);
router.use("/", dashboardRoutes);
router.use("/", aiRoutes);
router.use("/", surveyRoutes);
router.use("/", auditRoutes);
router.use("/", actionsRoutes);

export default router;
