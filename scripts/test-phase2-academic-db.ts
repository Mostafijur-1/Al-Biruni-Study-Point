import assert from "node:assert/strict";

import mongoose from "mongoose";
import { NextRequest } from "next/server";

import {
  assignTeacher,
  createBatch,
  createClassSession,
  createRoutineSlot,
  endTeacherAssignment,
  endRoutineSlot,
  enrollStudent,
  transitionClassSession,
  transferStudent,
} from "../lib/academic-workflows.ts";
import { ApiRouteError } from "../lib/api-error.ts";
import { AcademicSession } from "../lib/db/models/AcademicSession.ts";
import { AcademicSubject } from "../lib/db/models/AcademicSubject.ts";
import { AuditLog } from "../lib/db/models/AuditLog.ts";
import { Batch } from "../lib/db/models/Batch.ts";
import { BatchEnrollment } from "../lib/db/models/BatchEnrollment.ts";
import { Branch } from "../lib/db/models/Branch.ts";
import { Organization } from "../lib/db/models/Organization.ts";
import { TeacherAssignment } from "../lib/db/models/TeacherAssignment.ts";
import { User } from "../lib/db/models/User.ts";

const uri = process.env.ACADEMIC_TEST_MONGODB_URI?.trim();
const dbName = process.env.ACADEMIC_TEST_DB_NAME?.trim();
if (!uri) throw new Error("ACADEMIC_TEST_MONGODB_URI is required.");
if (!dbName || !/^absp_[a-z0-9_]*test$/i.test(dbName) || dbName === "absp") {
  throw new Error("ACADEMIC_TEST_DB_NAME must be an explicit absp_*test database.");
}

await mongoose.connect(uri, { dbName });

const cleanup = async () => {
  await Promise.all([
    AuditLog.deleteMany({}),
    TeacherAssignment.deleteMany({}),
    BatchEnrollment.deleteMany({}),
    Batch.deleteMany({}),
    AcademicSubject.deleteMany({}),
    AcademicSession.deleteMany({}),
    Branch.deleteMany({}),
    Organization.deleteMany({}),
    User.deleteMany({}),
  ]);
};

try {
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") {
    throw new Error("Academic DB integration tests require transaction-capable MongoDB.");
  }

  await cleanup();
  const request = new NextRequest("http://localhost/api/academic-test", {
    headers: { "x-request-id": "academic-db-integration-test" },
  });
  const password = "integration-test-password-hash";
  const [admin, teacher, firstStudent, secondStudent] = await User.create([
    { name: "Admin", email: "admin@test.invalid", password, role: "admin" },
    {
      name: "Teacher",
      email: "teacher@test.invalid",
      password,
      role: "teacher",
      approvalStatus: "approved",
    },
    {
      name: "Student One",
      email: "student-one@test.invalid",
      password,
      role: "student",
      studentClass: "class-9",
    },
    {
      name: "Student Two",
      email: "student-two@test.invalid",
      password,
      role: "student",
      studentClass: "class-9",
    },
  ]);
  const actor = {
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    role: "admin" as const,
  };
  const organization = await Organization.create({ name: "Test Org", slug: "test-org" });
  const branch = await Branch.create({
    organizationId: organization._id,
    name: "Test Branch",
    code: "TEST",
  });
  const academicSession = await AcademicSession.create({
    organizationId: organization._id,
    name: "2026 Test",
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2026-12-31T23:59:59.000Z"),
    status: "active",
  });
  const subject = await AcademicSubject.create({
    organizationId: organization._id,
    code: "PHY",
    name: "Physics",
    nameBn: "পদার্থবিজ্ঞান",
    classLevels: ["class-9"],
  });
  const batchInput = {
    request,
    actor,
    organizationId: String(organization._id),
    branchId: String(branch._id),
    academicSessionId: String(academicSession._id),
    studentClass: "class-9" as const,
    subjectNames: ["Physics"],
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2026-12-31T23:59:59.000Z"),
    reason: "Database integration test",
  };
  const firstBatch = await createBatch({
    ...batchInput,
    code: "B-1",
    name: "Batch One",
    capacity: 1,
  });
  const secondBatch = await createBatch({
    ...batchInput,
    code: "B-2",
    name: "Batch Two",
    capacity: 2,
  });
  const firstEnrollment = await enrollStudent({
    request,
    actor,
    batchId: String(firstBatch._id),
    studentId: String(firstStudent._id),
    effectiveFrom: new Date("2026-01-02T00:00:00.000Z"),
    reason: "Confirmed test enrollment",
  });
  await assert.rejects(
    enrollStudent({
      request,
      actor,
      batchId: String(firstBatch._id),
      studentId: String(secondStudent._id),
      effectiveFrom: new Date("2026-01-02T00:00:00.000Z"),
      reason: "Capacity test enrollment",
    }),
    (error) => error instanceof ApiRouteError && error.status === 409,
  );
  assert.equal((await Batch.findById(firstBatch._id).lean())?.activeEnrollmentCount, 1);

  const transferred = await transferStudent({
    request,
    actor,
    enrollmentId: String(firstEnrollment._id),
    targetBatchId: String(secondBatch._id),
    effectiveAt: new Date("2026-02-01T00:00:00.000Z"),
    reason: "Approved integration transfer",
  });
  assert.equal(transferred.status, "active");
  assert.equal((await Batch.findById(firstBatch._id).lean())?.activeEnrollmentCount, 0);
  assert.equal((await Batch.findById(secondBatch._id).lean())?.activeEnrollmentCount, 1);

  const assignment = await assignTeacher({
    request,
    actor,
    batchId: String(secondBatch._id),
    teacherId: String(teacher._id),
    subjectId: String(subject._id),
    effectiveFrom: new Date("2026-01-02T00:00:00.000Z"),
    reason: "Approved integration assignment",
  });
  const routine = await createRoutineSlot({
    request,
    actor,
    batchId: String(secondBatch._id),
    teacherId: String(teacher._id),
    subjectId: String(subject._id),
    weekday: 1,
    startMinute: 9 * 60,
    endMinute: 10 * 60,
    room: "Test Room",
    effectiveFrom: new Date("2026-01-02T00:00:00.000Z"),
    effectiveTo: new Date("2026-06-30T00:00:00.000Z"),
    reason: "Approved integration routine",
  });
  await assert.rejects(
    createRoutineSlot({
      request,
      actor,
      batchId: String(secondBatch._id),
      teacherId: String(teacher._id),
      subjectId: String(subject._id),
      weekday: 1,
      startMinute: 9 * 60 + 30,
      endMinute: 10 * 60 + 30,
      effectiveFrom: new Date("2026-01-02T00:00:00.000Z"),
      effectiveTo: new Date("2026-06-30T00:00:00.000Z"),
      reason: "Routine conflict integration test",
    }),
    (error) => error instanceof ApiRouteError && error.status === 409,
  );
  const classSession = await createClassSession({
    request,
    actor,
    assignmentId: String(assignment._id),
    routineSlotId: String(routine._id),
    scheduledStart: new Date("2026-01-05T03:00:00.000Z"),
    scheduledEnd: new Date("2026-01-05T04:00:00.000Z"),
    reason: "Approved integration class",
  });
  const completedClass = await transitionClassSession({
    request,
    actor,
    classSessionId: String(classSession._id),
    nextStatus: "completed",
    reason: "Integration class completed",
  });
  assert.equal(completedClass.status, "completed");
  await endRoutineSlot({
    request,
    actor,
    routineSlotId: String(routine._id),
    effectiveAt: new Date("2026-06-30T00:00:00.000Z"),
    reason: "Integration routine end",
  });
  const endedAssignment = await endTeacherAssignment({
    request,
    actor,
    assignmentId: String(assignment._id),
    effectiveAt: new Date("2026-06-30T00:00:00.000Z"),
    reason: "Integration assignment end",
  });
  assert.equal(endedAssignment.status, "ended");
  assert.equal(await AuditLog.countDocuments({ requestId: "academic-db-integration-test" }), 10);

  console.log(JSON.stringify({ status: "passed", database: dbName }, null, 2));
} finally {
  await cleanup();
  await mongoose.disconnect();
}
