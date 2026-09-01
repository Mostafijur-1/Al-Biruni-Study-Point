import path from "node:path";
import { z } from "zod";

export const LEGACY_CONTRACTION_ID = "step10-legacy-authority-v1";
export const LEGACY_OBSERVATION_DAYS = 28;

export const deprecatedAuthorities = [
  { id: "teacher-domain", field: "users.teacherDomain", retention: "Remove after canonical TeacherAssignment parity; retain approved audit exports for seven years." },
  { id: "string-curriculum", field: "subject/chapter/class strings", retention: "Keep aliases only in import adapters and immutable historical snapshots." },
  { id: "duplicate-results", field: "legacy mutable result collections", retention: "Retain immutable attempts/publications and rebuildable projections; archive original migration evidence." },
  { id: "embedded-binaries", field: "writtenexams.questionFile.data", retention: "No new writes. Retain legacy bytes read-only until the approved historical retention decision is executed." },
] as const;

const sha = z.string().regex(/^[a-f\d]{40}$/i);
const evidenceCount = z.object({ reads: z.number().int().min(0), writes: z.number().int().min(0), unexplainedReads: z.number().int().min(0) });
export const legacyContractionEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  contractionId: z.literal(LEGACY_CONTRACTION_ID),
  environment: z.literal("production"),
  testedCommit: sha,
  observationStartedAt: z.string().datetime(),
  observationEndedAt: z.string().datetime(),
  shorterWindowApproval: z.object({ approvedBy: z.string().trim().min(2).max(120), approvedAt: z.string().datetime(), reason: z.string().trim().min(10).max(500) }).optional(),
  telemetry: z.object(Object.fromEntries(deprecatedAuthorities.map((item) => [item.id, evidenceCount])) as Record<(typeof deprecatedAuthorities)[number]["id"], typeof evidenceCount>),
  backupRestore: z.object({ completedAt: z.string().datetime(), snapshotReferenceHash: z.string().regex(/^[a-f\d]{64}$/i), restoreTarget: z.literal("isolated-non-production"), integrityChecksPassed: z.boolean(), restoreOwner: z.string().trim().min(2).max(120) }),
  verification: z.object({ fullTestsPassed: z.boolean(), typecheckPassed: z.boolean(), lintPassed: z.boolean(), buildPassed: z.boolean(), authenticatedJourneys: z.object({ admin: z.boolean(), teacher: z.boolean(), student: z.boolean() }), accessibilitySmokePassed: z.boolean(), rollbackDrillPassed: z.boolean() }),
  retentionPolicyApproved: z.boolean(),
  approvedBy: z.string().trim().min(2).max(120),
  approvedAt: z.string().datetime(),
});

export type LegacyContractionEvidence = z.output<typeof legacyContractionEvidenceSchema>;

export function evaluateLegacyContractionEvidence(evidence: LegacyContractionEvidence, currentCommit: string) {
  const blockers: string[] = [];
  const started = Date.parse(evidence.observationStartedAt);
  const ended = Date.parse(evidence.observationEndedAt);
  const observationDays = (ended - started) / 86_400_000;
  if (!Number.isFinite(observationDays) || observationDays <= 0) blockers.push("The compatibility observation window is invalid.");
  if (observationDays < LEGACY_OBSERVATION_DAYS && !evidence.shorterWindowApproval) blockers.push(`The observation window is shorter than ${LEGACY_OBSERVATION_DAYS} days without explicit approval.`);
  if (evidence.testedCommit !== currentCommit) blockers.push("Contraction evidence is not bound to the current commit.");
  for (const authority of deprecatedAuthorities) {
    const telemetry = evidence.telemetry[authority.id];
    if (telemetry.writes !== 0) blockers.push(`${authority.id} still has deprecated writes.`);
    if (telemetry.unexplainedReads !== 0) blockers.push(`${authority.id} still has unexplained deprecated reads.`);
  }
  if (!evidence.backupRestore.integrityChecksPassed) blockers.push("The isolated backup restore rehearsal did not pass integrity checks.");
  if (!evidence.retentionPolicyApproved) blockers.push("The historical retention policy is not approved.");
  const checks = evidence.verification;
  if (![checks.fullTestsPassed, checks.typecheckPassed, checks.lintPassed, checks.buildPassed, checks.authenticatedJourneys.admin, checks.authenticatedJourneys.teacher, checks.authenticatedJourneys.student, checks.accessibilitySmokePassed, checks.rollbackDrillPassed].every(Boolean)) blockers.push("One or more required release, browser, accessibility, or rollback checks did not pass.");
  return { eligible: blockers.length === 0, observationDays, blockers };
}

export function resolveLegacyEvidencePath(workspaceRoot: string, requestedPath: string) {
  const root = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(root, requestedPath);
  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) throw new Error("Legacy contraction evidence path must stay inside the workspace.");
  return resolvedPath;
}
