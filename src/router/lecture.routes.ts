import { Router } from "express";
import {
  createLecture,
  deleteLecture,
  getLecturesSchedule,
  updateLecture,
} from "../controllers/lectureController";
import {
  getNextLectureForDoctor,
  getNextLectureForStudent,
  getNextLectureForTeacher,
  manualGenerateWeeklyLectures,
  publishWeeklyLecture,
  toggleCancelWeeklyLecture,
} from "../controllers/weeklyLecturesController";
import { markAttendance } from "../controllers/attendanceController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get(
  "/lectures",
  authMiddleware,
  check("lectures:read"),
  getLecturesSchedule,
);
router.post("/lectures", authMiddleware, check("lectures:add"), createLecture);
router.put(
  "/lectures/:id",
  authMiddleware,
  check("lectures:update"),
  updateLecture,
);
router.delete(
  "/lectures/:id",
  authMiddleware,
  check("lectures:delete"),
  deleteLecture,
);

router.post(
  "/cron/generate-weekly-lectures",
  authMiddleware,
  check("weekly-lectures:generate"),
  manualGenerateWeeklyLectures,
);
router.get(
  "/weekly-lectures/next/student",
  authMiddleware,
  check("weekly-lectures:read"),
  getNextLectureForStudent,
);
router.get(
  "/weekly-lectures/next/teacher",
  authMiddleware,
  check("weekly-lectures:read"),
  getNextLectureForTeacher,
);
router.get(
  "/weekly-lectures/next/doctor",
  authMiddleware,
  check("weekly-lectures:read"),
  getNextLectureForDoctor,
);
router.post(
  "/weekly-lectures/:id/publish",
  authMiddleware,
  check("weekly-lectures:publish"),
  publishWeeklyLecture,
);
router.post(
  "/weekly-lectures/:id/toggle-cancel",
  authMiddleware,
  check("weekly-lectures:toggle-cancel"),
  toggleCancelWeeklyLecture,
);

router.post(
  "/attendance/mark",
  authMiddleware,
  check("attendance:mark"),
  markAttendance,
);

export default router;
