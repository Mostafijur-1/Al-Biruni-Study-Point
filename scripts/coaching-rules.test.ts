import assert from "node:assert/strict";
import test from "node:test";

import {
  isCoachingStudent,
  isEffectiveAt,
  resolveEligibleStudentIds,
} from "../lib/coaching-rules.ts";

test("registration alone is not a coaching enrollment", () => {
  assert.equal(isCoachingStudent(0), false);
  assert.equal(isCoachingStudent(1), true);
});

test("routine and attendance eligibility require both matching batch and subject", () => {
  const students = resolveEligibleStudentIds({
    batchId: "hsc-2028",
    subjectId: "physics",
    enrollments: [
      { studentId: "rahim", batchId: "hsc-2028", subjectIds: ["physics", "chemistry", "ict"] },
      { studentId: "karim", batchId: "hsc-2028", subjectIds: ["physics"] },
      { studentId: "nadia", batchId: "hsc-2028", subjectIds: ["chemistry", "ict"] },
      { studentId: "other-batch", batchId: "hsc-2029", subjectIds: ["physics"] },
    ],
  });
  assert.deepEqual(students, ["karim", "rahim"]);
});

test("later subject drop does not invalidate historical class-time eligibility", () => {
  const started = new Date("2026-08-01T00:00:00.000Z");
  const dropped = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(isEffectiveAt(started, dropped, new Date("2026-08-01T10:00:00.000Z")), true);
  assert.equal(isEffectiveAt(started, dropped, new Date("2026-08-16T10:00:00.000Z")), false);
});
