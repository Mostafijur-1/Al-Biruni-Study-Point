import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  latestPhase3ReleaseGateTimestamp,
  phase3ReleaseEvidenceMatchesCommit,
  phase3ReleaseEvidenceSchema,
  resolveWorkspacePhase3ReleaseEvidencePath,
} from "../lib/phase3-release-evidence.ts";

function validReleaseEvidence() {
  const gate = {
    status: "passed" as const,
    completedAt: "2026-08-05T10:00:00.000Z",
    reviewedBy: "Release evidence reviewer",
    reportRef: "evidence/phase3/report-001",
  };

  return {
    schemaVersion: 1 as const,
    environment: "staging" as const,
    scope: "phase3-attendance-first-slice" as const,
    authorizedBaseCommit: "8d97971",
    releaseCommit: "aaaaaaaa",
    attendanceWritesDefaultOff: true as const,
    migrationDryRun: gate,
    migrationApply: gate,
    migrationRollback: gate,
    schemaAndIndexes: gate,
    databaseTransactions: gate,
    authorizationScope: gate,
    idempotencyAndConcurrency: gate,
    correctionAudit: gate,
    calculationPolicy: gate,
    outboxReplay: gate,
    privacyAndSecurity: gate,
    browserValidation: {
      ...gate,
      teacherMobile: true as const,
      adminDesktop: true as const,
      studentOwnView: true as const,
      keyboard: true as const,
      screenReader: true as const,
      zoomReflow: true as const,
      reducedMotion: true as const,
      banglaCopy: true as const,
    },
    observability: gate,
    rollbackDrill: gate,
    runtimeWriteRolloutApproval: {
      approved: true as const,
      approvedAt: "2026-08-05T11:00:00.000Z",
      approvedBy: "Pilot rollout approver",
      changeRef: "changes/phase3-pilot-001",
      initialScope: "named-pilot-branch" as const,
      pilotBranchRef: "branches/pilot-001",
    },
  };
}

test("attendance release evidence requires every bounded gate", () => {
  assert.equal(phase3ReleaseEvidenceSchema.safeParse(validReleaseEvidence()).success, true);
  const incomplete = validReleaseEvidence() as Record<string, unknown>;
  delete incomplete.correctionAudit;
  assert.equal(phase3ReleaseEvidenceSchema.safeParse(incomplete).success, false);
});

test("attendance release evidence requires default-off writes and complete browser coverage", () => {
  assert.equal(
    phase3ReleaseEvidenceSchema.safeParse({
      ...validReleaseEvidence(),
      attendanceWritesDefaultOff: false,
    }).success,
    false,
  );
  assert.equal(
    phase3ReleaseEvidenceSchema.safeParse({
      ...validReleaseEvidence(),
      browserValidation: {
        ...validReleaseEvidence().browserValidation,
        screenReader: false,
      },
    }).success,
    false,
  );
});

test("pilot rollout approval must follow the final release gate", () => {
  const evidence = validReleaseEvidence();
  evidence.rollbackDrill = {
    ...evidence.rollbackDrill,
    completedAt: "2026-08-05T12:00:00.000Z",
  };
  assert.equal(latestPhase3ReleaseGateTimestamp(evidence), "2026-08-05T12:00:00.000Z");
  assert.equal(phase3ReleaseEvidenceSchema.safeParse(evidence).success, false);
});

test("attendance release evidence rejects placeholders and extra authority", () => {
  assert.equal(
    phase3ReleaseEvidenceSchema.safeParse({
      ...validReleaseEvidence(),
      runtimeWriteRolloutApproval: {
        ...validReleaseEvidence().runtimeWriteRolloutApproval,
        approvedBy: "REPLACE_WITH_APPROVER",
      },
    }).success,
    false,
  );
  assert.equal(
    phase3ReleaseEvidenceSchema.safeParse({
      ...validReleaseEvidence(),
      productionRolloutApproved: true,
    }).success,
    false,
  );
});

test("attendance release evidence paths cannot escape the workspace", () => {
  assert.throws(
    () => resolveWorkspacePhase3ReleaseEvidencePath("C:\\workspace", "..\\outside.json"),
    /inside the workspace/,
  );
});

test("attendance release evidence is valid only for the current release commit", () => {
  assert.equal(
    phase3ReleaseEvidenceMatchesCommit(
      "aaaaaaaa",
      "aaaaaaaa00000000000000000000000000000000",
    ),
    true,
  );
  assert.equal(
    phase3ReleaseEvidenceMatchesCommit(
      "bbbbbbb",
      "aaaaaaaa00000000000000000000000000000000",
    ),
    false,
  );
});

test("attendance release checking stays read-only and cannot unlock writes", async () => {
  const checker = await readFile("scripts/check-phase3-attendance-release.ts", "utf8");
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.["check:attendance-release"],
    "node --env-file=.env.local --no-warnings --experimental-strip-types scripts/check-phase3-attendance-release.ts",
  );
  assert.match(checker, /attendanceRuntimeUnlocked: false/);
  assert.match(checker, /merge-base/);
  assert.doesNotMatch(checker, /MONGODB_URI|mongoose|connectToDatabase|writeFile|appendFile/);
});
