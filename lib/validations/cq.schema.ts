import { z } from "zod";

import { targetClassesSchema } from "@/lib/validations/content.schema";

export const createCqAssignmentSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional().or(z.literal("")),
  targetClasses: targetClassesSchema,
  totalMarks: z.number().min(1).max(100).default(10),
  dueDate: z.string().datetime().optional(),
  isPublished: z.boolean().default(true),
});

export type CreateCqAssignmentInput = z.output<typeof createCqAssignmentSchema>;
