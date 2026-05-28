import { z } from "zod";

export const markAttendanceSchema = z.object({
  // TODO: remove student_id from body and read from auth token instead
  student_id: z.number().int().positive(),
  weekly_lecture_id: z.number().int().positive(),
  qr_string: z.string().uuid(),
});

export type MarkAttendanceDTO = z.infer<typeof markAttendanceSchema>;