import { Router } from "express";
import {
  createYear,
  deleteYear,
  getAllYears,
  getYearById,
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
  createMajor,
  deleteMajor,
  getAllMajors,
  updateMajor,
} from "../controllers/majorController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

// Years
router.get("/years", authMiddleware, check("years:read"), getAllYears);
router.get("/years/:id", authMiddleware, check("years:read"), getYearById);
router.post("/years", authMiddleware, check("years:add"), createYear);
router.put("/years/:id", authMiddleware, check("years:update"), updateYear);
router.delete("/years/:id", authMiddleware, check("years:delete"), deleteYear);

// Sections
router.get("/sections", authMiddleware, check("sections:read"), getAllSections);
router.post("/sections", authMiddleware, check("sections:add"), createSection);
router.put(
  "/sections/:id",
  authMiddleware,
  check("sections:update"),
  updateSection,
);
router.delete(
  "/sections/:id",
  authMiddleware,
  check("sections:delete"),
  deleteSection,
);

// Majors
router.get("/majors", authMiddleware, check("majors:read"), getAllMajors);
router.post("/majors", authMiddleware, check("majors:add"), createMajor);
router.put("/majors/:id", authMiddleware, check("majors:update"), updateMajor);
router.delete(
  "/majors/:id",
  authMiddleware,
  check("majors:delete"),
  deleteMajor,
);

// Groups
router.get("/groups", authMiddleware, check("groups:read"), getAllGroups);
router.post("/groups", authMiddleware, check("groups:add"), createGroup);
router.put("/groups/:id", authMiddleware, check("groups:update"), updateGroup);
router.delete(
  "/groups/:id",
  authMiddleware,
  check("groups:delete"),
  deleteGroup,
);

export default router;
