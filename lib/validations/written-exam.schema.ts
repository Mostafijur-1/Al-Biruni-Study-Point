import { z } from "zod";

export const writtenExamObjectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record identifier.");
const createSchema = z.object({ action: z.literal("create"), batchId: writtenExamObjectId, subjectId: writtenExamObjectId, title: z.string().trim().min(2).max(160), examDate: z.coerce.date(), totalMarks: z.coerce.number().min(1).max(10_000), instructions: z.string().trim().max(1_000).optional() });
const marksSchema = z.object({ action: z.literal("save-marks"), examId: writtenExamObjectId, results: z.array(z.object({ studentId: writtenExamObjectId, marks: z.coerce.number().min(0), comment: z.string().trim().max(500).optional() })).min(1).max(500) });
const publishSchema = z.object({ action: z.literal("publish"), examId: writtenExamObjectId });
const updateSchema = z.object({ action: z.literal("update"), examId: writtenExamObjectId, title: z.string().trim().min(2).max(160), examDate: z.coerce.date(), totalMarks: z.coerce.number().min(1).max(10_000), instructions: z.string().trim().max(1_000).optional() });
const correctionSchema = z.object({ action: z.literal("correct-result"), examId: writtenExamObjectId, studentId: writtenExamObjectId, marks: z.coerce.number().min(0), comment: z.string().trim().max(500).optional(), reason: z.string().trim().min(3).max(500) });
const questionLinkSchema = z.object({
  action: z.literal("set-question-link"), examId: writtenExamObjectId,
  url: z.union([z.null(), z.url().max(2_000).refine((value) => {
    const host = new URL(value).hostname.toLowerCase();
    return host === "drive.google.com" || host === "docs.google.com";
  }, "Question link must use Google Drive.")]),
});

export const writtenExamMutationSchema = z.discriminatedUnion("action", [createSchema, marksSchema, publishSchema, updateSchema, correctionSchema, questionLinkSchema]);
export type WrittenExamMutationInput = z.output<typeof writtenExamMutationSchema>;
