import { Router } from "express";
import { runEndYearAction } from "../controllers/promotionController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.post(
  "/actions/end-year-action",
  authMiddleware,
  check("actions:end-year-action"),
  runEndYearAction,
);

export default router;
