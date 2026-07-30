import { z } from "zod";

export const markAttendanceSchema = z.object({
  weekly_lecture_id: z.number().int().positive(),
  qr_string: z.string().uuid(),
});

export type MarkAttendanceDTO = z.infer<typeof markAttendanceSchema>;