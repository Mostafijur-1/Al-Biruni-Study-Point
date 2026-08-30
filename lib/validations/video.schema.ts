import { z } from "zod";

import { targetClassesSchema } from "@/lib/validations/content.schema";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid canonical subject ID.");

export const createVideoSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional().or(z.literal("")),
  subject: z.string().trim().min(1).max(120).optional(),
  subjectId: objectIdSchema.optional(),
  videoUrl: z.string().trim().url("Enter a valid video URL."),
  targetClasses: targetClassesSchema,
  isPublished: z.boolean().default(true),
});

export type CreateVideoInput = z.output<typeof createVideoSchema>;
