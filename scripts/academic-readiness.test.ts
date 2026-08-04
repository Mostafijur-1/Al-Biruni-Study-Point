import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAcademicReadiness,
  isSafeAcademicTestDatabaseName,
} from "../lib/academic-readiness.ts";

test("academic readiness accepts only explicitly disposable test database names", () => {
  assert.equal(isSafeAcademicTestDatabaseName("absp_academic_test"), true);
  assert.equal(isSafeAcademicTestDatabaseName("absp_test"), true);
  assert.equal(isSafeAcademicTestDatabaseName("absp"), false);
  assert.equal(isSafeAcademicTestDatabaseName("production"), false);
  assert.equal(isSafeAcademicTestDatabaseName(undefined), false);
});

test("academic readiness stays blocked when any prerequisite is absent", () => {
  const result = evaluateAcademicReadiness({
    approvedManifestValid: false,
    testMongoUriConfigured: true,
    testDatabaseName: "absp_academic_test",
    academicWritesEnabled: false,
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.phase3Unlocked, false);
});

test("readiness permits external validation but never unlocks Phase 3 automatically", () => {
  const result = evaluateAcademicReadiness({
    approvedManifestValid: true,
    testMongoUriConfigured: true,
    testDatabaseName: "absp_academic_test",
    academicWritesEnabled: false,
  });
  assert.equal(result.status, "ready-for-external-validation");
  assert.equal(result.phase3Unlocked, false);
  assert.equal(result.remainingExternalGates.length, 5);
});

test("reviewed evidence creates eligibility but still requires explicit Phase 3 authorization", () => {
  const result = evaluateAcademicReadiness({
    approvedManifestValid: true,
    testMongoUriConfigured: true,
    testDatabaseName: "absp_academic_test",
    academicWritesEnabled: false,
    externalEvidenceValid: true,
  });
  assert.equal(result.rolloutEligibility, "eligible-for-explicit-phase3-authorization");
  assert.equal(result.phase3Unlocked, false);
  assert.deepEqual(result.remainingExternalGates, [
    "Obtain explicit authorization to begin Phase 3 attendance work.",
  ]);
});
