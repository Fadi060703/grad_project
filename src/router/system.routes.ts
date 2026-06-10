import { Router } from "express";
import multer from "multer";
import {
  createUniversityLocation,
  deleteUniversityLocation,
  getAllUniversityLocations,
  updateUniversityLocation,
} from "../controllers/locationsController";
import {
  createOrUpdateSystemSettings,
  getSystemSettings,
} from "../controllers/settingsController";
import { uploadFile } from "../controllers/uploadFilesController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get(
  "/locations",
  authMiddleware,
  check("locations:read"),
  getAllUniversityLocations,
);
router.post(
  "/locations",
  authMiddleware,
  check("locations:add"),
  createUniversityLocation,
);
router.put(
  "/locations/:id",
  authMiddleware,
  check("locations:update"),
  updateUniversityLocation,
);
router.delete(
  "/locations/:id",
  authMiddleware,
  check("locations:delete"),
  deleteUniversityLocation,
);

router.get(
  "/system-settings",
  authMiddleware,
  check("system-settings:read"),
  getSystemSettings,
);
router.put(
  "/system-settings",
  authMiddleware,
  check("system-settings:update"),
  createOrUpdateSystemSettings,
);

router.post(
  "/file/upload",
  authMiddleware,
  check("files:upload"),
  upload.single("file"),
  uploadFile,
);

export default router;
