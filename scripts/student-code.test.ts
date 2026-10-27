import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatStudentCode,
  getStudentCodePrefix,
  parseStudentCodeSequence,
  suggestNextFromLastCode,
  suggestNextStudentCode,
} from "../lib/student-code.ts";

test("HSC 2028 default group starts with the requested permanent ID format", () => {
  const prefix = getStudentCodePrefix({ name: "HSC 2028" });
  assert.equal(prefix, "28001");
  assert.equal(formatStudentCode(prefix!, 1), "2800101");
  assert.equal(formatStudentCode(prefix!, 12), "2800112");
});

test("a future second group has an independent 002 prefix", () => {
  const prefix = getStudentCodePrefix({ name: "HSC 2028 Female", studentIdGroup: 2 });
  assert.equal(prefix, "28002");
  assert.equal(formatStudentCode(prefix!, 1), "2800201");
});

test("Bengali year digits still produce the ASCII prefix", () => {
  assert.equal(getStudentCodePrefix({ name: "HSC ২০২৮" }), "28001");
});

test("next Student ID is suggested from the last assigned 7-digit code", () => {
  assert.equal(suggestNextStudentCode("28001", 12), "2800113");
  assert.equal(parseStudentCodeSequence("2800112", "28001"), 12);
  assert.equal(suggestNextFromLastCode("2800112"), "2800113");
  assert.equal(suggestNextStudentCode("28001", 99), null);
});

test("student codes are assigned only when absent and attendance is admin-wide", async () => {
  const enrollment = await readFile("lib/coaching-enrollment-service.ts", "utf8");
  const userModel = await readFile("lib/db/models/User.ts", "utf8");
  const attendanceApi = await readFile("app/api/admin/attendance/route.ts", "utf8");
  const register = await readFile("components/attendance/AdminAttendanceRegister.tsx", "utf8");
  const batchManager = await readFile("components/batches/AdminBatchManager.tsx", "utf8");
  const teacherAttendance = await readFile("components/attendance/TeacherAttendanceWorkspace.tsx", "utf8");

  assert.match(enrollment, /if \(input\.student\.studentCode\) return/);
  assert.match(enrollment, /StudentCodeCounter\.findOneAndUpdate/);
  assert.match(enrollment, /assignStudentCodeForBatch/);
  assert.match(enrollment, /input\.effectiveFrom < batch\.startsAt/);
  assert.match(userModel, /immutable: true/);
  assert.match(userModel, /unique: true, sparse: true/);
  assert.match(attendanceApi, /requireAuth\(request, \["admin"\]\)/);
  assert.match(attendanceApi, /backfill-student-codes/);
  assert.match(batchManager, /স্থায়ী Student ID/);
  assert.match(batchManager, /assign-student-code/);
  assert.match(batchManager, /defaultFeeTk/);
  assert.match(teacherAttendance, /row\.studentCode/);
  for (const column of ["Student ID", "শিক্ষার্থীর নাম", "তারিখ", "Attendance Status"]) {
    assert.match(register, new RegExp(column));
  }
});

test("batch switching reassigns student IDs for new cohort prefix and profile displays enrolled batch", async () => {
  const enrollment = await readFile("lib/coaching-enrollment-service.ts", "utf8");
  const profilePanel = await readFile("components/profile/ProfilePanel.tsx", "utf8");
  const studentDashboard = await readFile("components/student/StudentHomeDashboard.tsx", "utf8");
  const sessionAuth = await readFile("lib/auth/session.ts", "utf8");

  // Transfer updates studentCode and studentClass when cohort changes (e.g. SSC 2027 -> HSC 2029)
  assert.match(enrollment, /transferCoachingEnrollment/);
  assert.match(enrollment, /isValidStudentCodeForPrefix\(nextStudentCode, targetPrefix\)/);
  assert.match(enrollment, /userUpdates\.studentCode = nextStudentCode/);
  assert.match(enrollment, /userUpdates\.studentClass = targetBatch\.studentClass/);

  // Profile shows Student ID and Enrolled Batch
  assert.match(profilePanel, /user\.studentCode/);
  assert.match(profilePanel, /user\.enrolledBatch/);
  assert.match(profilePanel, /Student ID/);
  assert.match(profilePanel, /Enrolled Batch/);

  // Session loader resolves enrolledBatch for active students
  assert.match(sessionAuth, /enrolledBatch/);
  assert.match(sessionAuth, /BatchEnrollment\.findOne/);

  // Student dashboard shows studentCode and enrolledBatch badge
  assert.match(studentDashboard, /user\?\.studentCode/);
  assert.match(studentDashboard, /user\?\.enrolledBatch/);
});
