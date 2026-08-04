import path from "node:path";

import { z } from "zod";

const commitSchema = z.string().trim().regex(/^[a-f\d]{7,40}$/i, "Use a Git commit hash.");
const referenceSchema = z.string().trim().min(3).max(500);
const approverSchema = z.string().trim().min(2).max(120);

export const phase3AuthorizationSchema = z
  .object({
    schemaVersion: z.literal(1),
    decision: z.literal("approved"),
    authorizedBaseCommit: commitSchema,
    phase2EvidenceRef: referenceSchema,
    scope: z.literal("phase3-attendance-first-slice"),
    contractVersion: z.literal(1),
    runtimeWriteRolloutApproved: z.literal(false),
    approvedAt: z.string().datetime({ offset: true }),
    approvedBy: approverSchema,
    changeRef: referenceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (JSON.stringify(value).includes("REPLACE")) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Replace every Phase 3 authorization placeholder before approval.",
      });
    }
  });

export function resolveWorkspaceAuthorizationPath(workspaceRoot: string, authorizationPath: string) {
  const resolvedPath = path.resolve(workspaceRoot, authorizationPath);
  const relativePath = path.relative(workspaceRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("The Phase 3 authorization must be inside the workspace.");
  }

  return { resolvedPath, relativePath };
}

function commitMatchesCurrent(candidate: string, currentCommit: string) {
  return (
    /^[a-f\d]{7,40}$/i.test(candidate) &&
    /^[a-f\d]{40}$/i.test(currentCommit) &&
    currentCommit.toLowerCase().startsWith(candidate.toLowerCase())
  );
}

export function phase3AuthorizationMatchesEvidence(
  authorizedBaseCommit: string,
  evidenceCommit: string | undefined,
  currentCommit: string,
) {
  return Boolean(
    evidenceCommit &&
    commitMatchesCurrent(authorizedBaseCommit, currentCommit) &&
    commitMatchesCurrent(evidenceCommit, currentCommit),
  );
}

export function phase3AuthorizationFollowsEvidence(
  approvedAt: string,
  latestEvidenceAt: string | undefined,
) {
  if (!latestEvidenceAt) return false;

  const approvalTime = Date.parse(approvedAt);
  const evidenceTime = Date.parse(latestEvidenceAt);
  return Number.isFinite(approvalTime) && Number.isFinite(evidenceTime) && approvalTime >= evidenceTime;
}
