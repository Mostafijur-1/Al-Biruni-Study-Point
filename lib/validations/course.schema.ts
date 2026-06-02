import { z } from "zod";

import { targetClassesSchema } from "@/lib/validations/content.schema";

export const createCourseSchema = z.object({
  title: z.string().trim().min(3),
  titleBn: z.string().trim().min(3),
  description: z.string().trim().optional().or(z.literal("")),
  level: z.enum(["SSC", "HSC"]),
  subject: z.enum(["Physics", "Chemistry", "Math", "Higher Math", "ICT"]),
  targetClasses: targetClassesSchema,
  isPublished: z.boolean().default(true),
});

export type CreateCourseInput = z.output<typeof createCourseSchema>;
