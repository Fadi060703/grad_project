import express from "express";
import multer from "multer";
import {
  createStudent,
  createUser,
  deleteUser,
  getAllnonStudentUsers,
  getAllStudentUsers,
  getUserById,
  toggleUserActivity,
  updateStudent,
  updateUser,
} from "../controllers/userController";
import { login, me } from "../controllers/auth/auth";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";
import {
  createYear,
  deleteYear,
  getAllYears,
  updateYear,
} from "../controllers/yearController";
import {
  createSection,
  deleteSection,
  getAllSections,
  updateSection,
} from "../controllers/sectionController";
import {
  createGroup,
  deleteGroup,
  getAllGroups,
  updateGroup,
} from "../controllers/groupController";
import {
  createUniversityLocation,
  deleteUniversityLocation,
  getAllUniversityLocations,
  updateUniversityLocation,
} from "../controllers/locationsController";
import {
  createMajor,
  deleteMajor,
  getAllMajors,
  updateMajor,
} from "../controllers/majorController";
import {
  createCourse,
  deleteCourse,
  getAllCourses,
  updateCourse,
} from "../controllers/coursesController";
import {
  createOrUpdateSystemSettings,
  getSystemSettings,
} from "../controllers/settingsController";
import { uploadFile } from "../controllers/uploadFilesController";
import {
  createFaq,
  deleteFaq,
  getAllFaqs,
  updateFaq,
} from "../controllers/faqController";
import {
  createBlog,
  deleteBlog,
  getAllBlogs,
  updateBlog,
} from "../controllers/blogController";
import {
  createExamGuideline,
  deleteExamGuideline,
  getAllExamGuidelines,
  updateExamGuideline,
} from "../controllers/examGuidelineController";
import {
  createMarksCourse,
  deleteMarksCourse,
  getAllMarksCourses,
  updateMarksCourse,
} from "../controllers/marksCourseController";
import {
  bulkCreateMarks,
  bulkDeleteMarks,
  getAllMarks,
  updateMark,
} from "../controllers/marksController";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get("/users", getAllnonStudentUsers);
router.put("/users/toggle-active/:id", toggleUserActivity);
router.get("/students", getAllStudentUsers);
router.post("/students", createStudent);
router.put("/students/:id", updateStudent);
router.get("/users/:id", getUserById);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, me);
router.get("/years", getAllYears);
router.post("/years", createYear);
router.put("/years/:id", updateYear);
router.delete("/years/:id", deleteYear);
router.get("/sections", getAllSections);
router.post("/sections", createSection);
router.put("/sections/:id", updateSection);
router.delete("/sections/:id", deleteSection);
router.get("/majors", getAllMajors);
router.post("/majors", createMajor);
router.put("/majors/:id", updateMajor);
router.delete("/majors/:id", deleteMajor);
router.get("/groups", getAllGroups);
router.post("/groups", createGroup);
router.put("/groups/:id", updateGroup);
router.delete("/groups/:id", deleteGroup);
router.get("/locations", getAllUniversityLocations);
router.post("/locations", createUniversityLocation);
router.put("/locations/:id", updateUniversityLocation);
router.delete("/locations/:id", deleteUniversityLocation);
router.get("/courses", getAllCourses);
router.post("/courses", createCourse);
router.put("/courses/:id", updateCourse);
router.delete("/courses/:id", deleteCourse);

router.get("/system-settings", getSystemSettings);
router.put("/system-settings", createOrUpdateSystemSettings);

router.get("/faqs", getAllFaqs);
router.post("/faqs", createFaq);
router.put("/faqs/:id", updateFaq);
router.delete("/faqs/:id", deleteFaq);

router.get("/blogs", getAllBlogs);
router.post("/blogs", createBlog);
router.put("/blogs/:id", updateBlog);
router.delete("/blogs/:id", deleteBlog);

router.get("/exam-guidelines", getAllExamGuidelines);
router.post("/exam-guidelines", createExamGuideline);
router.put("/exam-guidelines/:id", updateExamGuideline);
router.delete("/exam-guidelines/:id", deleteExamGuideline);

router.get("/marks-courses", getAllMarksCourses);
router.post("/marks-courses", createMarksCourse);
router.put("/marks-courses/:id", updateMarksCourse);
router.delete("/marks-courses/:id", deleteMarksCourse);

router.get("/marks", getAllMarks);
router.post("/marks/bulk-create", bulkCreateMarks);
router.put("/marks/:id", updateMark);
router.delete("/marks/bulk-delete", bulkDeleteMarks);

router.post("/file/upload", upload.single("file"), uploadFile);

export default router;
