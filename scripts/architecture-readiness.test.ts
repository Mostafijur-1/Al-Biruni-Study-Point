import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertReadOnlyPipeline,
  classifyRuntimeEnvironment,
  containsSensitiveConnectionMaterial,
  createDuplicatePipeline,
  createOrphanPipeline,
  duplicateChecks,
  evaluateWriteGateSafety,
  orphanChecks,
  safeDatabaseFailure,
} from "../lib/architecture-readiness.ts";

test("architecture readiness classifies explicit deployment environments", () => {
  assert.equal(classifyRuntimeEnvironment({ requested: "production" }), "production");
  assert.equal(classifyRuntimeEnvironment({ vercel: "preview" }), "staging");
  assert.equal(classifyRuntimeEnvironment({ node: "test" }), "test");
  assert.equal(classifyRuntimeEnvironment({}), "unknown");
});

test("write gates fail closed when rollout evidence is absent", () => {
  const result = evaluateWriteGateSafety({
    academicWritesEnabled: true,
    attendanceWritesEnabled: true,
    academicEvidenceState: "missing",
    attendanceEvidenceState: "missing",
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.academic.safe, false);
  assert.equal(result.attendance.safe, false);
  assert.equal(result.blockers.length, 2);
});

test("disabled write gates are safe without rollout evidence", () => {
  const result = evaluateWriteGateSafety({
    academicWritesEnabled: false,
    attendanceWritesEnabled: false,
    academicEvidenceState: "missing",
    attendanceEvidenceState: "missing",
  });
  assert.equal(result.status, "safe");
  assert.deepEqual(result.blockers, []);
});

test("enabled write gates require valid commit-bound evidence", () => {
  const result = evaluateWriteGateSafety({
    academicWritesEnabled: true,
    attendanceWritesEnabled: true,
    academicEvidenceState: "valid",
    attendanceEvidenceState: "valid",
  });
  assert.equal(result.status, "safe");
});

test("every database aggregation is read-only", () => {
  for (const check of orphanChecks) {
    assert.doesNotThrow(() => assertReadOnlyPipeline(createOrphanPipeline(check)));
  }
  for (const check of duplicateChecks) {
    assert.doesNotThrow(() => assertReadOnlyPipeline(createDuplicatePipeline(check)));
  }
  assert.throws(
    () => assertReadOnlyPipeline([{ $match: {} }, { $merge: "unsafe" }]),
    /read-only/,
  );
  assert.throws(
    () => assertReadOnlyPipeline([{ $out: "unsafe" }]),
    /read-only/,
  );
});

test("database failures and reports never expose connection material", () => {
  const failure = safeDatabaseFailure();
  assert.equal(containsSensitiveConnectionMaterial(failure), false);
  assert.equal(containsSensitiveConnectionMaterial({ uri: "mongodb+srv://user:secret@cluster/db" }), true);
  assert.doesNotMatch(JSON.stringify(failure), /mongodb(?:\+srv)?:\/\/|user:secret|@cluster/i);
});

test("the readiness command contains no database mutation calls", async () => {
  const source = await readFile("scripts/check-architecture-readiness.ts", "utf8");
  const forbiddenCalls = [
    ".insertOne(", ".insertMany(", ".updateOne(", ".updateMany(",
    ".replaceOne(", ".deleteOne(", ".deleteMany(", ".findOneAndUpdate(",
    ".bulkWrite(", ".createIndex(", ".dropIndex(", ".drop(",
  ];
  for (const call of forbiddenCalls) assert.equal(source.includes(call), false, call);
  assert.match(source, /autoIndex: false/);
});
