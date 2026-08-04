import path from "node:path";

import { z } from "zod";

const commitSchema = z.string().trim().regex(/^[a-f\d]{7,40}$/i, "Use a Git commit hash.");
const referenceSchema = z.string().trim().min(3).max(500);
const reviewerSchema = z.string().trim().min(2).max(120);
const completedAtSchema = z.string().datetime({ offset: true });

const releaseGateKeys = [
  "migrationDryRun",
  "migrationApply",
  "migrationRollback",
  "schemaAndIndexes",
  "databaseTransactions",
  "authorizationScope",
  "idempotencyAndConcurrency",
  "correctionAudit",
  "calculationPolicy",
  "outboxReplay",
  "privacyAndSecurity",
  "browserValidation",
  "observability",
  "rollbackDrill",
] as const;

type ReleaseGateTimestampSource = Record<
  (typeof releaseGateKeys)[number],
  { completedAt: string }
>;

const passedGateSchema = z.object({
  status: z.literal("passed"),
  completedAt: completedAtSchema,
  reviewedBy: reviewerSchema,
  reportRef: referenceSchema,
}).strict();

export const phase3ReleaseEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    environment: z.literal("staging"),
    scope: z.literal("phase3-attendance-first-slice"),
    authorizedBaseCommit: commitSchema,
    releaseCommit: commitSchema,
    attendanceWritesDefaultOff: z.literal(true),
    migrationDryRun: passedGateSchema,
    migrationApply: passedGateSchema,
    migrationRollback: passedGateSchema,
    schemaAndIndexes: passedGateSchema,
    databaseTransactions: passedGateSchema,
    authorizationScope: passedGateSchema,
    idempotencyAndConcurrency: passedGateSchema,
    correctionAudit: passedGateSchema,
    calculationPolicy: passedGateSchema,
    outboxReplay: passedGateSchema,
    privacyAndSecurity: passedGateSchema,
    browserValidation: passedGateSchema.extend({
      teacherMobile: z.literal(true),
      adminDesktop: z.literal(true),
      studentOwnView: z.literal(true),
      keyboard: z.literal(true),
      screenReader: z.literal(true),
      zoomReflow: z.literal(true),
      reducedMotion: z.literal(true),
      banglaCopy: z.literal(true),
    }).strict(),
    observability: passedGateSchema,
    rollbackDrill: passedGateSchema,
    runtimeWriteRolloutApproval: z.object({
      approved: z.literal(true),
      approvedAt: completedAtSchema,
      approvedBy: reviewerSchema,
      changeRef: referenceSchema,
      initialScope: z.literal("named-pilot-branch"),
      pilotBranchRef: referenceSchema,
    }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (JSON.stringify(value).includes("REPLACE")) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Replace every attendance release-evidence placeholder before review.",
      });
    }

    const latestGateAt = latestPhase3ReleaseGateTimestamp(value);
    if (Date.parse(value.runtimeWriteRolloutApproval.approvedAt) < Date.parse(latestGateAt)) {
      context.addIssue({
        code: "custom",
        path: ["runtimeWriteRolloutApproval", "approvedAt"],
        message: "Runtime rollout approval must follow every recorded release gate.",
      });
    }
  });

export type Phase3ReleaseEvidence = z.infer<typeof phase3ReleaseEvidenceSchema>;

export function latestPhase3ReleaseGateTimestamp(evidence: ReleaseGateTimestampSource) {
  return new Date(
    Math.max(...releaseGateKeys.map((key) => Date.parse(evidence[key].completedAt))),
  ).toISOString();
}

export function resolveWorkspacePhase3ReleaseEvidencePath(
  workspaceRoot: string,
  evidencePath: string,
) {
  const resolvedPath = path.resolve(workspaceRoot, evidencePath);
  const relativePath = path.relative(workspaceRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("The Phase 3 release evidence must be inside the workspace.");
  }

  return { resolvedPath, relativePath };
}

export function phase3ReleaseEvidenceMatchesCommit(
  releaseCommit: string,
  currentCommit: string,
) {
  return (
    /^[a-f\d]{7,40}$/i.test(releaseCommit) &&
    /^[a-f\d]{40}$/i.test(currentCommit) &&
    currentCommit.toLowerCase().startsWith(releaseCommit.toLowerCase())
  );
}
