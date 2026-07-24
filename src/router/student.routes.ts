import { Router } from "express";
import multer from "multer";
import {
  changeMyStudentPassword,
  getMyStudentProfile,
  updateMyStudentProfile,
  uploadMyStudentProfilePicture,
} from "../controllers/studentProfileController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get(
  "/student/profile",
  authMiddleware,
  check("student-profile:read"),
  getMyStudentProfile,
);

router.put(
  "/student/profile",
  authMiddleware,
  check("student-profile:update"),
  updateMyStudentProfile,
);

router.put(
  "/student/profile/change-password",
  authMiddleware,
  check("student-profile:change-password"),
  changeMyStudentPassword,
);

router.post(
  "/student/profile/upload-picture",
  authMiddleware,
  check("student-profile:upload-picture"),
  upload.single("image"),
  uploadMyStudentProfilePicture,
);

export default router;
