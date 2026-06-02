import { z } from "zod";

const phoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .refine((value) => phoneRegex.test(value), {
    message: "Use a valid Bangladeshi phone number.",
  });

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

export const studentRegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters."),
  studentClass: studentClassSchema,
});

export const teacherRegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  phone: optionalPhoneSchema,
  email: z.string().trim().email("A valid email is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Phone or email is required."),
  password: z.string().min(1, "Password is required."),
  returnUrl: z.string().trim().optional().or(z.literal("")),
});

export const studentRegisterBodySchema = studentRegisterSchema.extend({
  returnUrl: z.string().trim().optional().or(z.literal("")),
});

export type StudentRegisterFormInput = z.input<typeof studentRegisterSchema>;
export type StudentRegisterInput = z.output<typeof studentRegisterSchema>;
export type TeacherRegisterFormInput = z.input<typeof teacherRegisterSchema>;
export type TeacherRegisterInput = z.output<typeof teacherRegisterSchema>;
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
