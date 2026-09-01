import assert from "node:assert/strict";
import test from "node:test";
import { deprecatedAuthorities, evaluateLegacyContractionEvidence, legacyContractionEvidenceSchema, resolveLegacyEvidencePath } from "../lib/legacy-contraction.ts";

const commit = "a".repeat(40);
function evidence() {
  return legacyContractionEvidenceSchema.parse({ schemaVersion: 1, contractionId: "step10-legacy-authority-v1", environment: "production", testedCommit: commit, observationStartedAt: "2026-09-01T00:00:00.000Z", observationEndedAt: "2026-09-29T00:00:00.000Z", telemetry: Object.fromEntries(deprecatedAuthorities.map((item) => [item.id, { reads: 0, writes: 0, unexplainedReads: 0 }])), backupRestore: { completedAt: "2026-09-29T01:00:00.000Z", snapshotReferenceHash: "b".repeat(64), restoreTarget: "isolated-non-production", integrityChecksPassed: true, restoreOwner: "Operations" }, verification: { fullTestsPassed: true, typecheckPassed: true, lintPassed: true, buildPassed: true, authenticatedJourneys: { admin: true, teacher: true, student: true }, accessibilitySmokePassed: true, rollbackDrillPassed: true }, retentionPolicyApproved: true, approvedBy: "Release owner", approvedAt: "2026-09-29T02:00:00.000Z" });
}

test("legacy contraction requires zero deprecated writes and unexplained reads", () => {
  const valid = evidence();
  assert.equal(evaluateLegacyContractionEvidence(valid, commit).eligible, true);
  valid.telemetry["teacher-domain"].writes = 1;
  const result = evaluateLegacyContractionEvidence(valid, commit);
  assert.equal(result.eligible, false);
  assert.match(result.blockers.join(" "), /deprecated writes/);
});

test("short observation windows require an explicit approval", () => {
  const value = evidence();
  value.observationEndedAt = "2026-09-08T00:00:00.000Z";
  assert.equal(evaluateLegacyContractionEvidence(value, commit).eligible, false);
  value.shorterWindowApproval = { approvedBy: "Release owner", approvedAt: "2026-09-08T01:00:00.000Z", reason: "One complete accelerated reporting cycle was reviewed." };
  assert.equal(evaluateLegacyContractionEvidence(value, commit).eligible, true);
});

test("legacy evidence paths cannot escape the workspace", () => {
  assert.throws(() => resolveLegacyEvidencePath("D:/projects/absp", "../secret.json"), /inside the workspace/);
});
