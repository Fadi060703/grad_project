import { z } from "zod";
import { BadRequestError } from "../errors";

const firstYearStudentSchema = z.object({
  student_id: z.coerce.number({ message: "رقم الطالب مطلوب" }).int("رقم الطالب يجب أن يكون رقماً صحيحاً").positive("رقم الطالب يجب أن يكون رقماً موجباً"),
  username: z.string({ message: "اسم المستخدم مطلوب" }).trim().min(1, "اسم المستخدم مطلوب"),
  full_name: z.string({ message: "اسم الطالب مطلوب" }).trim().min(1, "اسم الطالب مطلوب"),
  mother_name: z.string({ message: "اسم الأم مطلوب" }).trim().min(1, "اسم الأم مطلوب"),
});

const majorAssignmentSchema = z.object({
  student_id: z.coerce.number({ message: "رقم الطالب مطلوب" }).int("رقم الطالب يجب أن يكون رقماً صحيحاً").positive("رقم الطالب يجب أن يكون رقماً موجباً"),
  major_id: z.coerce.number({ message: "رقم الاختصاص مطلوب" }).int("رقم الاختصاص يجب أن يكون رقماً صحيحاً").positive("رقم الاختصاص يجب أن يكون رقماً موجباً"),
});

export const startYearActionSchema = z.object({
  confirm: z.literal(true, {
    message: "يجب تأكيد تنفيذ إجراء بداية السنة",
  }),
  first_year_students: z.array(firstYearStudentSchema).default([]),
  major_assignments: z.array(majorAssignmentSchema).default([]),
});

export type StartYearActionInput = z.infer<typeof startYearActionSchema>;

export function parseStartYearActionInput(body: unknown): StartYearActionInput {
  const parsed = startYearActionSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "بيانات إجراء بداية السنة غير صحيحة";
    throw new BadRequestError(message);
  }

  return parsed.data;
}
