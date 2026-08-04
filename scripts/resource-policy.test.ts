import assert from "node:assert/strict";
import test from "node:test";

import { canManageTeacherOwnedResource } from "../lib/auth/resource-policy.ts";
import { isExamWithinTeacherDomain } from "../lib/auth/teacher-domain-rules.ts";

test("admin can manage any teacher-owned resource", () => {
  assert.equal(
    canManageTeacherOwnedResource({ id: "admin-1", role: "admin" }, "teacher-2"),
    true,
  );
});

test("teacher can manage only their own resource", () => {
  assert.equal(
    canManageTeacherOwnedResource({ id: "teacher-1", role: "teacher" }, "teacher-1"),
    true,
  );
  assert.equal(
    canManageTeacherOwnedResource({ id: "teacher-1", role: "teacher" }, "teacher-2"),
    false,
  );
});

test("student cannot manage teacher-owned resources", () => {
  assert.equal(
    canManageTeacherOwnedResource({ id: "student-1", role: "student" }, "teacher-1"),
    false,
  );
});

test("exam definitions stay inside the teacher's assigned classes and subjects", () => {
  const domain = {
    isAll: false,
    classes: ["class-9"] as const,
    subjects: ["Physics"],
  };
  assert.equal(
    isExamWithinTeacherDomain(
      { ...domain, classes: [...domain.classes] },
      "Physics",
      ["class-9"],
    ),
    true,
  );
  assert.equal(
    isExamWithinTeacherDomain(
      { ...domain, classes: [...domain.classes] },
      "Chemistry",
      ["class-9"],
    ),
    false,
  );
  assert.equal(
    isExamWithinTeacherDomain(
      { ...domain, classes: [...domain.classes] },
      "Physics",
      ["class-10"],
    ),
    false,
  );
});
