import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import academicRoutes from "./academic.routes";
import courseRoutes from "./course.routes";
import lectureRoutes from "./lecture.routes";
import examRoutes from "./exam.routes";
import contentRoutes from "./content.routes";
import systemRoutes from "./system.routes";

const router = Router();

router.use("/", authRoutes);
router.use("/", userRoutes);
router.use("/", academicRoutes);
router.use("/", courseRoutes);
router.use("/", lectureRoutes);
router.use("/", examRoutes);
router.use("/", contentRoutes);
router.use("/", systemRoutes);

export default router;
