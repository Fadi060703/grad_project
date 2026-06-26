import { Router } from "express";
import {
  bulkAddStudentsToExamSetting,
  createExam,
  deleteExam,
  deleteStudentFromExamSetting,
  getAllExams,
  getExamById,
  getExamSettingById,
  updateExam,
} from "../controllers/examsController";
import {
  bulkCreateMarks,
  bulkDeleteMarks,
  getAllMarks,
  updateMark,
} from "../controllers/marksController";
import {
  createMarksCourse,
  deleteMarksCourse,
  getAllMarksCourses,
  updateMarksCourse,
} from "../controllers/marksCourseController";
import {
  createExamGuideline,
  deleteExamGuideline,
  getAllExamGuidelines,
  updateExamGuideline,
} from "../controllers/examGuidelineController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get("/exams", authMiddleware, check("exams:read"), getAllExams);
router.get("/exams/:id", authMiddleware, check("exams:read"), getExamById);
router.get("/exam-settings/:id", authMiddleware, check("exams:read"), getExamSettingById);
router.post("/exams", authMiddleware, check("exams:add"), createExam);
router.put("/exams/:id", authMiddleware, check("exams:update"), updateExam);
router.delete("/exams/:id", authMiddleware, check("exams:delete"), deleteExam);
router.post("/exam-settings/:id/students", authMiddleware, check("exams:update"), bulkAddStudentsToExamSetting);
router.post("/exam-settings/:id/students/remove", authMiddleware, check("exams:update"), deleteStudentFromExamSetting);

router.get("/marks", authMiddleware, check("marks:read"), getAllMarks);
router.post(
  "/marks/bulk-create",
  authMiddleware,
  check("marks:add"),
  bulkCreateMarks,
);
router.put("/marks/:id", authMiddleware, check("marks:update"), updateMark);
router.delete(
  "/marks/bulk-delete",
  authMiddleware,
  check("marks:delete"),
  bulkDeleteMarks,
);

router.get(
  "/marks-courses",
  authMiddleware,
  check("marks-courses:read"),
  getAllMarksCourses,
);
router.post(
  "/marks-courses",
  authMiddleware,
  check("marks-courses:add"),
  createMarksCourse,
);
router.put(
  "/marks-courses/:id",
  authMiddleware,
  check("marks-courses:update"),
  updateMarksCourse,
);
router.delete(
  "/marks-courses/:id",
  authMiddleware,
  check("marks-courses:delete"),
  deleteMarksCourse,
);

router.get(
  "/exam-guidelines",
  authMiddleware,
  check("exam-guidelines:read"),
  getAllExamGuidelines,
);
router.post(
  "/exam-guidelines",
  authMiddleware,
  check("exam-guidelines:add"),
  createExamGuideline,
);
router.put(
  "/exam-guidelines/:id",
  authMiddleware,
  check("exam-guidelines:update"),
  updateExamGuideline,
);
router.delete(
  "/exam-guidelines/:id",
  authMiddleware,
  check("exam-guidelines:delete"),
  deleteExamGuideline,
);

export default router;
