import assert from "node:assert/strict";
import test from "node:test";

import {
  batchCreateSchema,
  classSessionMutationSchema,
  enrollmentMutationSchema,
  routineMutationSchema,
  teacherAssignmentListQuerySchema,
  teacherAssignmentMutationSchema,
} from "../lib/validations/academic.schema.ts";
import { requiresAcademicRoutineWriteGate } from "../lib/routine-write-gate.ts";

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

test("teacher assignment history can be requested without enabling writes", () => {
  assert.equal(teacherAssignmentListQuerySchema.parse({ status: "all" }).status, "all");
});

test("routine contracts reject inverted time windows", () => {
  const routine = routineMutationSchema.parse({
    action: "create",
    assignmentId: id,
    weekday: 6,
    startMinute: 9 * 60,
    endMinute: 10 * 60,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    reason: "Approved weekly timetable",
  });
  assert.equal(routine.action, "create");
  assert.equal(
    routineMutationSchema.safeParse({ ...routine, startMinute: routine.endMinute }).success,
    false,
  );
});

test("routine updates require a canonical teacher assignment without participant IDs", () => {
  const routine = routineMutationSchema.parse({
    action: "update",
    routineSlotId: id,
    assignmentId: id,
    weekday: 1,
    startMinute: 600,
    endMinute: 660,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    reason: "Approved routine update",
  });
  assert.equal(routine.action, "update");
  assert.equal(routine.assignmentId, id);
  assert.equal("studentIds" in routine, false);
});

test("routine contracts reject legacy teacher-domain writes without a canonical assignment", () => {
  const routine = routineMutationSchema.safeParse({
    action: "create",
    teacherId: id,
    subject: "Physics",
    studentIds: [id],
    weekday: 2,
    startMinute: 540,
    endMinute: 600,
    reason: "Approved domain routine",
  });
  assert.equal(routine.success, false);
});

test("every routine mutation remains behind the academic write gate", () => {
  assert.equal(requiresAcademicRoutineWriteGate({ action: "create" }), true);
  assert.equal(requiresAcademicRoutineWriteGate({ action: "update" }), true);
  assert.equal(requiresAcademicRoutineWriteGate({ action: "create", assignmentId: id }), true);
  assert.equal(requiresAcademicRoutineWriteGate({ action: "end" }), true);
});

test("class-session contracts use explicit create and terminal actions", () => {
  const classSession = classSessionMutationSchema.parse({
    action: "create",
    assignmentId: id,
    scheduledStart: "2026-08-04T03:00:00.000Z",
    scheduledEnd: "2026-08-04T04:00:00.000Z",
    reason: "Approved class schedule",
  });
  assert.equal(classSession.action, "create");

  assert.equal(
    classSessionMutationSchema.safeParse({
      action: "reopen",
      classSessionId: id,
      reason: "Not permitted",
    }).success,
    false,
  );
});
