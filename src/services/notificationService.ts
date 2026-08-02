import webpush from "web-push";
import { prisma } from "../lib/prisma";

type NotifyStudentsPayload = {
  title: string;
  body: string;
  route?: string;
  icon?: string;
};

type PushSendError = Error & {
  statusCode?: number;
};

let isWebPushConfigured = false;

const configureWebPush = () => {
  if (isWebPushConfigured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isWebPushConfigured = true;
};

export const notifyStudents = async (
  studentIds: number[],
  payload: NotifyStudentsPayload,
) => {
  const uniqueStudentIds = [...new Set(studentIds)].filter(
    (studentId) => Number.isInteger(studentId) && studentId > 0,
  );

  if (uniqueStudentIds.length === 0) {
    return {
      studentsRequested: studentIds.length,
      studentsFound: 0,
      notificationsCreated: 0,
      subscriptionsFound: 0,
      pushSent: 0,
      pushFailed: 0,
      subscriptionsDeleted: 0,
      skippedStudentIds: [],
    };
  }

  const students = await prisma.student.findMany({
    where: { student_id: { in: uniqueStudentIds } },
    select: { student_id: true },
  });

  const existingStudentIds = students.map((student) => student.student_id);
  const existingStudentIdSet = new Set(existingStudentIds);
  const skippedStudentIds = uniqueStudentIds.filter(
    (studentId) => !existingStudentIdSet.has(studentId),
  );

  if (existingStudentIds.length === 0) {
    return {
      studentsRequested: studentIds.length,
      studentsFound: 0,
      notificationsCreated: 0,
      subscriptionsFound: 0,
      pushSent: 0,
      pushFailed: 0,
      subscriptionsDeleted: 0,
      skippedStudentIds,
    };
  }

  const notifications = await prisma.$transaction(
    existingStudentIds.map((student_id) =>
      prisma.notification.create({
        data: {
          student_id,
          title: payload.title,
          body: payload.body,
          route: payload.route,
          icon: payload.icon,
        },
        select: {
          id: true,
          student_id: true,
        },
      }),
    ),
  );

  const notificationIdByStudentId = new Map(
    notifications.map((notification) => [notification.student_id, notification.id]),
  );

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { student_id: { in: existingStudentIds } },
    select: {
      id: true,
      student_id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  let pushSent = 0;
  let pushFailed = 0;
  const invalidSubscriptionIds = new Set<number>();

  if (subscriptions.length > 0) {
    configureWebPush();

    await Promise.all(
      subscriptions.map(async (subscription) => {
        const notificationId = notificationIdByStudentId.get(subscription.student_id);

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              icon: payload.icon,
              data: {
                route: payload.route,
                notificationId,
              },
            }),
          );

          pushSent += 1;
        } catch (err) {
          pushFailed += 1;
          const statusCode = (err as PushSendError).statusCode;

          if (statusCode === 404 || statusCode === 410) {
            invalidSubscriptionIds.add(subscription.id);
          }
        }
      }),
    );
  }

  let subscriptionsDeleted = 0;
  if (invalidSubscriptionIds.size > 0) {
    const deleteResult = await prisma.pushSubscription.deleteMany({
      where: { id: { in: [...invalidSubscriptionIds] } },
    });
    subscriptionsDeleted = deleteResult.count;
  }

  return {
    studentsRequested: studentIds.length,
    studentsFound: existingStudentIds.length,
    notificationsCreated: notifications.length,
    subscriptionsFound: subscriptions.length,
    pushSent,
    pushFailed,
    subscriptionsDeleted,
    skippedStudentIds,
  };
};
