import assert from "node:assert/strict";
import test from "node:test";

import {
  phase3AuthorizationFollowsEvidence,
  phase3AuthorizationMatchesEvidence,
  phase3AuthorizationSchema,
  resolveWorkspaceAuthorizationPath,
} from "../lib/phase3-authorization.ts";

function validAuthorization() {
  return {
    schemaVersion: 1 as const,
    decision: "approved" as const,
    authorizedBaseCommit: "031771e",
    phase2EvidenceRef: "evidence/phase2/review-001",
    scope: "phase3-attendance-first-slice" as const,
    contractVersion: 1 as const,
    runtimeWriteRolloutApproved: false as const,
    approvedAt: "2026-08-04T12:00:00.000Z",
    approvedBy: "Academic operations approver",
    changeRef: "changes/phase3-entry-001",
  };
}

test("Phase 3 authorization is bounded to the first attendance slice", () => {
  assert.equal(phase3AuthorizationSchema.safeParse(validAuthorization()).success, true);
  assert.equal(
    phase3AuthorizationSchema.safeParse({
      ...validAuthorization(),
      scope: "all-future-phases",
    }).success,
    false,
  );
});

test("Phase 3 entry authorization cannot approve runtime writes", () => {
  assert.equal(
    phase3AuthorizationSchema.safeParse({
      ...validAuthorization(),
      runtimeWriteRolloutApproved: true,
    }).success,
    false,
  );
});

test("Phase 3 authorization rejects placeholders and extra authority", () => {
  assert.equal(
    phase3AuthorizationSchema.safeParse({
      ...validAuthorization(),
      approvedBy: "REPLACE_WITH_APPROVER",
    }).success,
    false,
  );
  assert.equal(
    phase3AuthorizationSchema.safeParse({
      ...validAuthorization(),
      allowsProductionWrites: true,
    }).success,
    false,
  );
});

test("Phase 3 authorization paths cannot escape the workspace", () => {
  assert.throws(
    () => resolveWorkspaceAuthorizationPath("C:\\workspace", "..\\outside.json"),
    /inside the workspace/,
  );
});

test("Phase 3 authorization and evidence must match the current base commit", () => {
  const currentCommit = "031771e000000000000000000000000000000000";
  assert.equal(
    phase3AuthorizationMatchesEvidence("031771e", "031771e", currentCommit),
    true,
  );
  assert.equal(
    phase3AuthorizationMatchesEvidence("963b5ca", "031771e", currentCommit),
    false,
  );
  assert.equal(
    phase3AuthorizationMatchesEvidence("031771e", undefined, currentCommit),
    false,
  );
});

test("Phase 3 authorization must follow the final Phase 2 evidence gate", () => {
  assert.equal(
    phase3AuthorizationFollowsEvidence(
      "2026-08-04T12:00:00.000Z",
      "2026-08-04T11:59:59.000Z",
    ),
    true,
  );
  assert.equal(
    phase3AuthorizationFollowsEvidence(
      "2026-08-04T11:59:59.000Z",
      "2026-08-04T12:00:00.000Z",
    ),
    false,
  );
  assert.equal(
    phase3AuthorizationFollowsEvidence("2026-08-04T12:00:00.000Z", undefined),
    false,
  );
});
