import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(50, "Password must not exceed 50 characters")
  .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
  .regex(/[a-z]/, "Must contain at least one Lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

export const changeDashboardPasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type changeDashboardPasswordDTO = z.infer<typeof changeDashboardPasswordSchema>;
