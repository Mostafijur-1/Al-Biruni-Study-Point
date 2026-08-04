import path from "node:path";

import { z } from "zod";

const commitSchema = z.string().trim().regex(/^[a-f\d]{7,40}$/i, "Use a Git commit hash.");
const reportRefSchema = z.string().trim().min(3).max(500);
const reviewerSchema = z.string().trim().min(2).max(120);
const completedAtSchema = z.string().datetime({ offset: true });

const passedGateSchema = z.object({
  status: z.literal("passed"),
  completedAt: completedAtSchema,
  reviewedBy: reviewerSchema,
  reportRef: reportRefSchema,
});

export const academicRolloutEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    environment: z.literal("staging"),
    testedCommit: commitSchema,
    databaseIntegration: passedGateSchema,
    bootstrapDryRun: passedGateSchema,
    bootstrapApply: passedGateSchema,
    scopeParity: passedGateSchema,
    shadowRead: passedGateSchema,
    browserValidation: passedGateSchema.extend({
      mobile: z.literal(true),
      desktop: z.literal(true),
      keyboard: z.literal(true),
      screenReader: z.literal(true),
    }),
    academicWriteRolloutApproval: z.object({
      approved: z.literal(true),
      approvedAt: completedAtSchema,
      approvedBy: reviewerSchema,
      changeRef: reportRefSchema,
    }),
  })
  .superRefine((value, context) => {
    if (JSON.stringify(value).includes("REPLACE")) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Replace every rollout-evidence placeholder before review.",
      });
    }
  });

export type AcademicRolloutEvidence = z.infer<typeof academicRolloutEvidenceSchema>;

export function latestAcademicRolloutEvidenceTimestamp(evidence: AcademicRolloutEvidence) {
  const timestamps = [
    evidence.databaseIntegration.completedAt,
    evidence.bootstrapDryRun.completedAt,
    evidence.bootstrapApply.completedAt,
    evidence.scopeParity.completedAt,
    evidence.shadowRead.completedAt,
    evidence.browserValidation.completedAt,
    evidence.academicWriteRolloutApproval.approvedAt,
  ];

  return new Date(Math.max(...timestamps.map((value) => Date.parse(value)))).toISOString();
}

export function resolveWorkspaceEvidencePath(workspaceRoot: string, evidencePath: string) {
  const resolvedPath = path.resolve(workspaceRoot, evidencePath);
  const relativePath = path.relative(workspaceRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("The academic rollout evidence must be inside the workspace.");
  }
  return { resolvedPath, relativePath };
}

export function rolloutEvidenceMatchesCommit(testedCommit: string, currentCommit: string) {
  return (
    /^[a-f\d]{7,40}$/i.test(testedCommit) &&
    /^[a-f\d]{40}$/i.test(currentCommit) &&
    currentCommit.toLowerCase().startsWith(testedCommit.toLowerCase())
  );
}
