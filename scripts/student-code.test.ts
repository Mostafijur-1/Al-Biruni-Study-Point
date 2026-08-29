import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatStudentCode, getStudentCodePrefix } from "../lib/student-code.ts";

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

test("student codes are assigned only when absent and attendance is admin-wide", async () => {
  const enrollment = await readFile("lib/coaching-enrollment-service.ts", "utf8");
  const userModel = await readFile("lib/db/models/User.ts", "utf8");
  const attendanceApi = await readFile("app/api/admin/attendance/route.ts", "utf8");
  const register = await readFile("components/attendance/AdminAttendanceRegister.tsx", "utf8");

  assert.match(enrollment, /if \(input\.student\.studentCode\) return/);
  assert.match(enrollment, /StudentCodeCounter\.findOneAndUpdate/);
  assert.match(userModel, /immutable: true/);
  assert.match(userModel, /unique: true, sparse: true/);
  assert.match(attendanceApi, /requireAuth\(request, \["admin"\]\)/);
  assert.match(attendanceApi, /backfill-student-codes/);
  for (const column of ["Student ID", "Student name", "Date", "Attendance status"]) {
    assert.match(register, new RegExp(column));
  }
});
