import { z } from "zod";

export const adminUpdateUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  })
  .refine((value) => value.isActive !== undefined || value.approvalStatus !== undefined, {
    message: "No changes provided.",
  });

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
