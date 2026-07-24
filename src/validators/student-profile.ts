import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(50, "Password must not exceed 50 characters")
  .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
  .regex(/[a-z]/, "Must contain at least one Lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const relationNameSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
});

const birthdateInputSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.date().nullable(),
);

export const getStudentProfileSchema = z.object({
  student_id: z.number().positive(),
  full_name: z.string(),
  username: z.string(),
  email: z.string().email().nullable(),
  phone_number: z.string().nullable(),
  mother_name: z.string(),
  exam_seat_number: z.number().int(),
  birthdate: z.date().nullable(),
  profile_picture: z.string().nullable(),
  year: relationNameSchema,
  section: relationNameSchema.nullable(),
  major: relationNameSchema.nullable(),
  group: relationNameSchema,
});

export const updateStudentProfileSchema = z
  .object({
    username: z.string().trim().min(3).max(20).optional(),
    email: z.string().trim().email().optional(),
    phone_number: z.string().trim().optional().nullable(),
    birthdate: birthdateInputSchema.optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one profile field is required",
  });

export const changeStudentPasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type getStudentProfileDTO = z.infer<typeof getStudentProfileSchema>;
export type updateStudentProfileDTO = z.infer<typeof updateStudentProfileSchema>;
export type changeStudentPasswordDTO = z.infer<typeof changeStudentPasswordSchema>;
