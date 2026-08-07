import { Router } from "express";
import {
  completeSurvey,
  createSurvey,
  deleteSurvey,
  generateSurveyAiInsights,
  getAllSurveys,
  getMyStudentSurveys,
  getStudentSurveyById,
  getSurveySummary,
  publishSurvey,
  submitSurveyAnswer,
  updateSurvey,
} from "../controllers/surveyController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get("/surveys", authMiddleware, check("surveys:read"), getAllSurveys);
router.post("/surveys", authMiddleware, check("surveys:add"), createSurvey);
router.put("/surveys/:id", authMiddleware, check("surveys:update"), updateSurvey);
router.delete("/surveys/:id", authMiddleware, check("surveys:delete"), deleteSurvey);

router.post(
  "/surveys/:id/publish",
  authMiddleware,
  check("surveys:update"),
  publishSurvey,
);
router.post(
  "/surveys/:id/complete",
  authMiddleware,
  check("surveys:update"),
  completeSurvey,
);
router.post(
  "/surveys/:id/generate-ai-insights",
  authMiddleware,
  check("surveys:update"),
  generateSurveyAiInsights,
);
router.get(
  "/surveys/:id/summary",
  authMiddleware,
  check("surveys:read"),
  getSurveySummary,
);

router.get(
  "/my-student-surveys",
  authMiddleware,
  check("student-surveys:read"),
  getMyStudentSurveys,
);
router.get(
  "/surveys/:id",
  authMiddleware,
  check("student-surveys:read"),
  getStudentSurveyById,
);
router.post(
  "/surveys/:id/answers",
  authMiddleware,
  check("student-surveys:add"),
  submitSurveyAnswer,
);

export default router;
