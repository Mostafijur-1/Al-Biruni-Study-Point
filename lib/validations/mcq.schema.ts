import { z } from "zod";

import { targetClassesSchema } from "@/lib/validations/content.schema";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id.");

export const mcqQuestionInputSchema = z.object({
  question: z.string().trim().min(3),
  questionBn: z.string().trim().optional().or(z.literal("")),
  options: z.array(z.string().trim().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().optional().or(z.literal("")),
  marks: z.number().positive().default(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  topic: z.string().trim().optional().or(z.literal("")),
});

export const createMcqExamSchema = z.object({
  title: z.string().trim().min(3),
  targetClasses: targetClassesSchema,
  courseId: objectIdSchema.optional(),
  duration: z.number().int().min(1).max(300),
  passMark: z.number().min(0),
  negativeMarking: z.number().min(0).default(0),
  isRandomized: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attempts: z.number().int().min(1).max(20).default(1),
  questions: z.array(mcqQuestionInputSchema).min(1),
});

export const submitMcqExamSchema = z.object({
  examId: objectIdSchema,
  answers: z.array(
    z.object({
      questionId: objectIdSchema,
      selectedIndex: z.number().int().min(0).max(3),
    }),
  ),
  timeTaken: z.number().int().min(0),
});

export const updateMcqExamSchema = createMcqExamSchema;

export type CreateMcqExamFormInput = z.input<typeof createMcqExamSchema>;
export type CreateMcqExamInput = z.output<typeof createMcqExamSchema>;
export type UpdateMcqExamInput = z.output<typeof updateMcqExamSchema>;
export type SubmitMcqExamInput = z.output<typeof submitMcqExamSchema>;
