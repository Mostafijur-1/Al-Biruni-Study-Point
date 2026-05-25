import { z } from "zod";

const phoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || phoneRegex.test(value), {
    message: "Use a valid Bangladeshi phone number.",
  });

export const studentClassSchema = z.enum([
  "class-9",
  "class-10",
  "class-11",
  "class-12",
]);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters."),
    phone: optionalPhoneSchema,
    email: z.string().trim().email().optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters."),
    role: z.enum(["student", "teacher"]).default("student"),
    studentClass: studentClassSchema.optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.role === "student" && !data.phone) {
      ctx.addIssue({
        code: "custom",
        message: "Phone number is required for student registration.",
        path: ["phone"],
      });
    }

    if (data.role === "student" && !data.studentClass) {
      ctx.addIssue({
        code: "custom",
        message: "Class is required for student registration.",
        path: ["studentClass"],
      });
    }

    if (data.role === "teacher" && !data.email) {
      ctx.addIssue({
        code: "custom",
        message: "Email is required for teacher registration.",
        path: ["email"],
      });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Phone or email is required."),
  password: z.string().min(1, "Password is required."),
});

export type RegisterFormInput = z.input<typeof registerSchema>;
export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;

export function normalizePhone(phone: string) {
  const trimmed = phone.trim();

  if (trimmed.startsWith("+88")) {
    return trimmed.slice(3);
  }

  if (trimmed.startsWith("88") && trimmed.length === 13) {
    return trimmed.slice(2);
  }

  return trimmed;
}
