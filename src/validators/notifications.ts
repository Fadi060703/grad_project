import { z } from "zod";

export const pushSubscriptionSchema = z
  .object({
    endpoint: z.string().trim().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().trim().min(1),
      auth: z.string().trim().min(1),
    }),
  })
  .strict();

export const deletePushSubscriptionSchema = z
  .object({
    endpoint: z.string().trim().url().optional(),
  })
  .strict();

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type PushSubscriptionDTO = z.infer<typeof pushSubscriptionSchema>;
export type DeletePushSubscriptionDTO = z.infer<typeof deletePushSubscriptionSchema>;
