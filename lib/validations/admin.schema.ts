import { z } from "zod";

export const adminUpdateUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
    teacherDomain: z
      .object({
        isAll: z.boolean(),
        classes: z.array(z.string()),
        subjects: z.array(z.string()),
        students: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .refine(
    (value) =>
      value.isActive !== undefined ||
      value.approvalStatus !== undefined ||
      value.teacherDomain !== undefined,
    {
      message: "No changes provided.",
    }
  );

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
