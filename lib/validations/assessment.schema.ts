import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

export const assessmentResponseSchema = z.object({
  questionVersionId: objectIdSchema,
  selectedOptionKeys: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  textResponse: z.string().trim().max(20_000).optional(),
}).superRefine((response, context) => {
  if (new Set(response.selectedOptionKeys).size !== response.selectedOptionKeys.length) {
    context.addIssue({ code: "custom", path: ["selectedOptionKeys"], message: "Selected option keys must be unique." });
  }
});

export const assessmentSubmissionSchema = z.object({
  assessmentVersionId: objectIdSchema,
  attemptSessionId: objectIdSchema,
  responses: z.array(assessmentResponseSchema).max(500),
});

export type AssessmentSubmissionInput = z.infer<typeof assessmentSubmissionSchema>;
