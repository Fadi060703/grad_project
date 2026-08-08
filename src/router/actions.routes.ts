import { Router } from "express";
import { runEndYearAction, runStartYearAction } from "../controllers/promotionController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.post(
  "/actions/end-year-action",
  authMiddleware,
  check("actions:end-year-action"),
  runEndYearAction,
);

router.post(
  "/actions/start-year-action",
  authMiddleware,
  check("actions:start-year-action"),
  runStartYearAction,
);

export default router;
