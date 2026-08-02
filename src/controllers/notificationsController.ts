import { Request, Response } from "express";
import { createListHandler } from "../lib/express-prisma-query";
import { prisma } from "../lib/prisma";
import { ForbiddenError, NotFoundError } from "../errors";
import { asyncHandler } from "../utils/asyncHandler";
import {
  deletePushSubscriptionSchema,
  notificationIdParamSchema,
  pushSubscriptionSchema,
} from "../validators/notifications";
import { notifyStudents } from "../services";

type AuthUser = { id: number | string; role: string };

const getLoggedInStudent = async (req: Request) => {
  const { id, role } = req.user as AuthUser;
  const userId = Number(id);

  if (role !== "STUDENT" || !Number.isInteger(userId) || userId <= 0) {
    throw new ForbiddenError("Only students can access notifications");
  }

  const student = await prisma.student.findUnique({
    where: { userId },
    select: { student_id: true },
  });

  if (!student) {
    throw new ForbiddenError("Student profile not found");
  }

  return student;
};

export const upsertPushSubscription = asyncHandler(async (req: Request, res: Response) => {
  const student = await getLoggedInStudent(req);
  const data = pushSubscriptionSchema.parse(req.body);

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: {
      student_id: student.student_id,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
    },
    update: {
      student_id: student.student_id,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
    },
    select: {
      id: true,
      student_id: true,
      endpoint: true,
      created_at: true,
      updated_at: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Push subscription saved successfully",
    data: subscription,
  });
});

export const deletePushSubscription = asyncHandler(async (req: Request, res: Response) => {
  const student = await getLoggedInStudent(req);
  const data = deletePushSubscriptionSchema.parse(req.body ?? {});

  const result = await prisma.pushSubscription.deleteMany({
    where: {
      student_id: student.student_id,
      ...(data.endpoint ? { endpoint: data.endpoint } : {}),
    },
  });

  return res.status(200).json({
    success: true,
    message: data.endpoint
      ? "Push subscription deleted successfully"
      : "All push subscriptions deleted successfully",
    data: { deleted_count: result.count },
  });
});

export const getNotifications = createListHandler({
  prisma: prisma.notification,
  allowedSortFields: ["id", "title", "body", "route", "icon", "is_read", "created_at"],
  fieldTypes: {
    id: "number",
    student_id: "number",
    title: "text",
    body: "text",
    route: "text",
    icon: "text",
    is_read: "boolean",
    created_at: "date",
  },
  searchableFields: ["title", "body"],
  findManyArgs: {
    select: {
      id: true,
      student_id: true,
      title: true,
      body: true,
      route: true,
      icon: true,
      is_read: true,
      created_at: true,
    },
  },
  handleFindArgs: async ({ req, findManyArgs }) => {
    const student = await getLoggedInStudent(req);

    return {
      ...findManyArgs,
      where: {
        ...findManyArgs.where,
        student_id: student.student_id,
      },
      orderBy: findManyArgs.orderBy ?? { created_at: "desc" },
    };
  },
});

export const getUnreadNotificationsCount = asyncHandler(async (req: Request, res: Response) => {
  const student = await getLoggedInStudent(req);

  const count = await prisma.notification.count({
    where: {
      student_id: student.student_id,
      is_read: false,
    },
  });

  return res.status(200).json({
    success: true,
    data: { count },
  });
});

export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response) => {
  const student = await getLoggedInStudent(req);
  const { id } = notificationIdParamSchema.parse(req.params);

  const result = await prisma.notification.updateMany({
    where: {
      id,
      student_id: student.student_id,
    },
    data: { is_read: true },
  });

  if (result.count === 0) {
    throw new NotFoundError("Notification");
  }

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: {
      id: true,
      student_id: true,
      title: true,
      body: true,
      route: true,
      icon: true,
      is_read: true,
      created_at: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

export const sendDevTestNotification = asyncHandler(async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    throw new ForbiddenError("Dev test notifications are disabled in production");
  }

  const result = await notifyStudents([1], {
    title: "Test notification",
    body: "Backend push test",
    icon: "/logo_light_mode.svg",
    route: "/test-push.html",
  });

  return res.status(200).json({
    success: true,
    message: "Dev test notification attempted for student_id 1",
    data: result,
  });
});
