import assert from "node:assert/strict";
import test from "node:test";

import {
  batchCreateSchema,
  batchUpdateSchema,
  classSessionMutationSchema,
  enrollmentMutationSchema,
  routineMutationSchema,
  teacherAssignmentListQuerySchema,
  teacherAssignmentMutationSchema,
} from "../lib/validations/academic.schema.ts";
import { isRoutineMutationEnabled, requiresAcademicRoutineWriteGate } from "../lib/routine-write-gate.ts";

const id = "64f000000000000000000001";

test("batch creation accepts a name, type, default subjects, and default fee", () => {
  assert.deepEqual(
    batchCreateSchema.parse({ name: "HSC 2029", mode: "offline", defaultFeeTk: 3500, subjectNames: ["Physics", "Chemistry"] }),
    { name: "HSC 2029", mode: "offline", defaultFeeTk: 3500, subjectNames: ["Physics", "Chemistry"] },
  );
  assert.equal(batchCreateSchema.safeParse({}).success, false);
  assert.equal(batchCreateSchema.safeParse({ name: "Science Batch", mode: "offline", defaultFeeTk: 3500, subjectNames: ["Physics"] }).success, false);
  assert.equal(batchCreateSchema.safeParse({ name: "HSC 2029", mode: "offline", defaultFeeTk: 3500, subjectNames: [] }).success, false);
});

test("batch management requires an explicit audited change", () => {
  assert.equal(batchUpdateSchema.parse({ batchId: id, status: "active", reason: "Approved batch activation" }).status, "active");
  assert.deepEqual(batchUpdateSchema.parse({ batchId: id, subjectNames: ["Physics"], reason: "Update batch subjects" }).subjectNames, ["Physics"]);
  assert.equal(batchUpdateSchema.parse({ batchId: id, mode: "online", defaultFeeTk: 4000, reason: "Update batch delivery and fee" }).defaultFeeTk, 4000);
  assert.equal(batchUpdateSchema.safeParse({ batchId: id, reason: "No actual batch change" }).success, false);
  assert.equal(batchUpdateSchema.safeParse({ batchId: id, status: "deleted", reason: "Invalid destructive state" }).success, false);
});

test("enrollment mutations require explicit actions, valid IDs, and audit reasons", () => {
  const studentCode = enrollmentMutationSchema.parse({
    action: "assign-student-code",
    batchId: id,
    studentId: "64f000000000000000000002",
    reason: "Assign permanent ID before enrollment",
  });
  assert.equal(studentCode.action, "assign-student-code");
  const enrollment = enrollmentMutationSchema.parse({
    action: "enroll",
    batchId: id,
    studentId: "64f000000000000000000002",
    feeTk: 2500,
    guardianPhone: "01700000000",
    guardianRelation: "father",
    reason: "Confirmed admission roster",
  });
  assert.equal(enrollment.action, "enroll");
  assert.equal(enrollment.guardianPhone, "01700000000");
  assert.equal(enrollmentMutationSchema.safeParse({ ...enrollment, guardianPhone: "০১৭০০০০০০০০" }).success, false);

  const optionalEnrollment = enrollmentMutationSchema.parse({
    action: "enroll",
    batchId: id,
    studentId: "64f000000000000000000002",
    feeTk: 2500,
    guardianPhone: "",
    reason: "Enrollment with optional empty guardian phone",
  });
  assert.equal(optionalEnrollment.action, "enroll");
  if (optionalEnrollment.action === "enroll") {
    assert.equal(optionalEnrollment.guardianPhone, undefined);
    assert.equal(optionalEnrollment.guardianRelation, undefined);
  }

  const omittedGuardianEnrollment = enrollmentMutationSchema.parse({
    action: "enroll",
    batchId: id,
    studentId: "64f000000000000000000002",
    feeTk: 2500,
    reason: "Enrollment without guardian phone provided",
  });
  assert.equal(omittedGuardianEnrollment.action, "enroll");
  if (omittedGuardianEnrollment.action === "enroll") {
    assert.equal(omittedGuardianEnrollment.guardianPhone, undefined);
    assert.equal(omittedGuardianEnrollment.guardianRelation, undefined);
  }

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
    batchId: id,
    teacherId: "64f000000000000000000002",
    subjectId: "64f000000000000000000003",
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

test("routine updates require independent batch, teacher, and subject fields", () => {
  const routine = routineMutationSchema.parse({
    action: "update",
    routineSlotId: id,
    batchId: id,
    teacherId: "64f000000000000000000002",
    subjectId: "64f000000000000000000003",
    weekday: 1,
    startMinute: 600,
    endMinute: 660,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    reason: "Approved routine update",
  });
  assert.equal(routine.action, "update");
  assert.equal(routine.batchId, id);
  assert.equal(routine.teacherId, "64f000000000000000000002");
  assert.equal(routine.subjectId, "64f000000000000000000003");
  assert.equal("studentIds" in routine, false);
});

test("routine contracts reject legacy participant targeting", () => {
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

test("routine publishing can be enabled without enabling edit or end", () => {
  const publishOnly = { academicWrites: "false", routinePublishing: " true " };
  assert.equal(isRoutineMutationEnabled({ action: "create" }, publishOnly), true);
  assert.equal(isRoutineMutationEnabled({ action: "update" }, publishOnly), false);
  assert.equal(isRoutineMutationEnabled({ action: "end" }, publishOnly), false);
  assert.equal(isRoutineMutationEnabled(
    { action: "update" },
    { academicWrites: "true", routinePublishing: "false" },
  ), true);
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
