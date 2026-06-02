import { z } from "zod";

import { targetClassesSchema } from "@/lib/validations/content.schema";

export const createVideoSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional().or(z.literal("")),
  videoUrl: z.string().trim().url("Enter a valid video URL."),
  targetClasses: targetClassesSchema,
  isPublished: z.boolean().default(true),
});

export type CreateVideoInput = z.output<typeof createVideoSchema>;
