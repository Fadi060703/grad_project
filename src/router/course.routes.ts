import { Router } from "express";
import multer from "multer";
import {
  createCourse,
  deleteCourse,
  getAllCourses,
  getCourseGroups,
  getCourseTargets,
  getDoctorCourseStudents,
  getMyCourses,
  getTeacherCourseStudents,
  updateCourse,
} from "../controllers/coursesController";
import {
  createCourseFile,
  deleteCourseFile,
  getAllCourseFiles,
  updateCourseFile,
  uploadCourseFile,
} from "../controllers/courseFilesController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/my-courses", authMiddleware, check("my-courses:read"), getMyCourses);

router.get("/courses/:course_id/targets",         authMiddleware, check("my-courses:read"), getCourseTargets);
router.get("/courses/:course_id/groups",          authMiddleware, check("my-courses:read"), getCourseGroups);
router.get("/courses/:course_id/doctor-students", authMiddleware, check("my-courses:read"), getDoctorCourseStudents);
router.get("/courses/:course_id/teacher-students",authMiddleware, check("my-courses:read"), getTeacherCourseStudents);

router.get("/courses", authMiddleware, check("courses:read"), getAllCourses);
router.post("/courses", authMiddleware, check("courses:add"), createCourse);
router.put(
  "/courses/:id",
  authMiddleware,
  check("courses:update"),
  updateCourse,
);
router.delete(
  "/courses/:id",
  authMiddleware,
  check("courses:delete"),
  deleteCourse,
);

router.get(
  "/courses/:course_id/files",
  authMiddleware,
  check("course-files:read"),
  getAllCourseFiles,
);
router.post(
  "/courses/:course_id/files",
  authMiddleware,
  check("course-files:add"),
  createCourseFile,
);
router.put(
  "/courses/:course_id/files/:id",
  authMiddleware,
  check("course-files:update"),
  updateCourseFile,
);
router.delete(
  "/courses/:course_id/files/:id",
  authMiddleware,
  check("course-files:delete"),
  deleteCourseFile,
);
router.post(
  "/courses/:course_id/files/upload",
  authMiddleware,
  check("course-files:upload"),
  upload.single("file"),
  uploadCourseFile,
);

export default router;
