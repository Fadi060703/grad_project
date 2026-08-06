import { Router } from "express";
import { generateExamPreparationHtml } from "../controllers/aiExamPreparationController";
import {
  courseChat,
  getCourseChatMessages,
} from "../controllers/courseChatController";
import {
  getUniversityChatbotMessages,
  universityChatbot,
} from "../controllers/universityChatbotController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get("/chatbot/messages", authMiddleware, getUniversityChatbotMessages);
router.post("/chatbot", authMiddleware, universityChatbot);

router.post(
  "/course-chat",
  authMiddleware,
  check("course-files:read"),
  courseChat,
);
router.get(
  "/course-chat/:course_id/messages",
  authMiddleware,
  check("course-files:read"),
  getCourseChatMessages,
);

router.post(
  "/ai/exam-preparation",
  authMiddleware,
  check("course-files:read"),
  generateExamPreparationHtml,
);

export default router;
