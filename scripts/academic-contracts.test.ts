import assert from "node:assert/strict";
import test from "node:test";

import {
  batchCreateSchema,
  enrollmentMutationSchema,
  teacherAssignmentMutationSchema,
} from "../lib/validations/academic.schema.ts";

const id = "64f000000000000000000001";

test("batch creation requires a bounded capacity and valid date range", () => {
  const batch = batchCreateSchema.parse({
    organizationId: id,
    branchId: "64f000000000000000000002",
    academicSessionId: "64f000000000000000000003",
    code: "HSC-26-A",
    name: "HSC 2026 A",
    studentClass: "class-11",
    capacity: 40,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T00:00:00.000Z",
    reason: "Approved annual batch plan",
  });
  assert.equal(batch.capacity, 40);

  assert.equal(
    batchCreateSchema.safeParse({ ...batch, capacity: 0 }).success,
    false,
  );
  assert.equal(
    batchCreateSchema.safeParse({ ...batch, startsAt: batch.endsAt }).success,
    false,
  );
});

test("enrollment mutations require explicit actions, valid IDs, and audit reasons", () => {
  const enrollment = enrollmentMutationSchema.parse({
    action: "enroll",
    batchId: id,
    studentId: "64f000000000000000000002",
    reason: "Confirmed admission roster",
  });
  assert.equal(enrollment.action, "enroll");

  assert.equal(
    enrollmentMutationSchema.safeParse({
      action: "transfer",
      enrollmentId: id,
      targetBatchId: "invalid",
      reason: "Move",
    }).success,
    false,
  );
});

test("teacher assignment mutations distinguish assign and end contracts", () => {
  const assignment = teacherAssignmentMutationSchema.parse({
    action: "assign",
    batchId: id,
    teacherId: "64f000000000000000000002",
    subjectId: "64f000000000000000000003",
    effectiveFrom: "2026-08-04T00:00:00.000Z",
    reason: "Approved teaching allocation",
  });
  assert.equal(assignment.action, "assign");
  assert.ok(assignment.effectiveFrom instanceof Date);

  assert.equal(
    teacherAssignmentMutationSchema.safeParse({
      action: "end",
      assignmentId: id,
      reason: "x",
    }).success,
    false,
  );
});
