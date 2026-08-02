import { Router } from "express";
import {
  deletePushSubscription,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  sendDevTestNotification,
  upsertPushSubscription,
} from "../controllers/notificationsController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.post(
  "/push-subscriptions",
  authMiddleware,
  check("push-subscriptions:manage"),
  upsertPushSubscription,
);

router.delete(
  "/push-subscriptions",
  authMiddleware,
  check("push-subscriptions:manage"),
  deletePushSubscription,
);

router.get(
  "/notifications/unread-count",
  authMiddleware,
  check("notifications:read"),
  getUnreadNotificationsCount,
);

router.get(
  "/notifications",
  authMiddleware,
  check("notifications:read"),
  getNotifications,
);

router.patch(
  "/notifications/:id/read",
  authMiddleware,
  check("notifications:update"),
  markNotificationAsRead,
);

if (process.env.NODE_ENV !== "production") {
  router.post("/dev/test-notification", authMiddleware, sendDevTestNotification);
}

export default router;
