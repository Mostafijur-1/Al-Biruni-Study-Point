import assert from "node:assert/strict";
import test from "node:test";

import {
  academicRolloutEvidenceSchema,
  resolveWorkspaceEvidencePath,
  rolloutEvidenceMatchesCommit,
} from "../lib/academic-rollout-evidence.ts";

function validEvidence() {
  const gate = {
    status: "passed" as const,
    completedAt: "2026-08-04T10:00:00.000Z",
    reviewedBy: "Academic operations reviewer",
    reportRef: "evidence/phase2/report-001",
  };
  return {
    schemaVersion: 1 as const,
    environment: "staging" as const,
    testedCommit: "d486c92",
    databaseIntegration: gate,
    bootstrapDryRun: gate,
    bootstrapApply: gate,
    scopeParity: gate,
    shadowRead: gate,
    browserValidation: {
      ...gate,
      mobile: true as const,
      desktop: true as const,
      keyboard: true as const,
      screenReader: true as const,
    },
    academicWriteRolloutApproval: {
      approved: true as const,
      approvedAt: "2026-08-04T11:00:00.000Z",
      approvedBy: "Release approver",
      changeRef: "changes/phase2-rollout-001",
    },
  };
}

test("rollout evidence requires every reviewed external gate", () => {
  assert.equal(academicRolloutEvidenceSchema.safeParse(validEvidence()).success, true);
  const incomplete = validEvidence() as Record<string, unknown>;
  delete incomplete.scopeParity;
  assert.equal(academicRolloutEvidenceSchema.safeParse(incomplete).success, false);
});

test("rollout evidence rejects placeholders and incomplete browser coverage", () => {
  assert.equal(
    academicRolloutEvidenceSchema.safeParse({
      ...validEvidence(),
      testedCommit: "REPLACE_WITH_TESTED_COMMIT",
    }).success,
    false,
  );
  assert.equal(
    academicRolloutEvidenceSchema.safeParse({
      ...validEvidence(),
      browserValidation: { ...validEvidence().browserValidation, keyboard: false },
    }).success,
    false,
  );
});

test("rollout evidence paths cannot escape the workspace", () => {
  assert.throws(
    () => resolveWorkspaceEvidencePath("C:\\workspace", "..\\outside.json"),
    /inside the workspace/,
  );
});

test("rollout evidence is valid only for the current commit", () => {
  assert.equal(
    rolloutEvidenceMatchesCommit(
      "d486c92",
      "d486c92000000000000000000000000000000000",
    ),
    true,
  );
  assert.equal(
    rolloutEvidenceMatchesCommit(
      "e3c00b5",
      "d486c92000000000000000000000000000000000",
    ),
    false,
  );
});
