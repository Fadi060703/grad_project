import { Router } from "express";
import {
  getMiniSchedule,
  getNextItem,
  getSchedule,
} from "../controllers/timeConditionedController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get(
  "/time-conditioned/next-item",
  authMiddleware,
  check("time-conditioned-items:read"),
  getNextItem,
);

router.get(
  "/time-conditioned/mini-schedule",
  authMiddleware,
  check("time-conditioned-items:read"),
  getMiniSchedule,
);

router.get(
  "/time-conditioned/schedule",
  authMiddleware,
  check("time-conditioned-items:read"),
  getSchedule,
);

export default router;
