import assert from "node:assert/strict";
import test from "node:test";

import { projectPracticeResult } from "../lib/mcq/practice-result-projection.ts";
import { isAssessmentKernelWriteEnabled } from "../lib/mcq/kernel-rollout.ts";

test("practice result projection is derived entirely from its authoritative attempt", () => {
  const submittedAt = new Date("2026-08-31T10:00:00.000Z");
  const projected = projectPracticeResult({
    _id: "attempt-1", attemptSession: "session-1", student: "student-1", subject: "Physics",
    score: 8, totalQuestions: 10, percentage: 80, isPassed: true, timeTaken: 300,
    teacherComment: "Good", isTeacherSet: false, isCancelled: false, passMarkPercent: 60,
    submittedAt, createdAt: submittedAt,
  } as never);
  assert.equal(projected.authoritativeAttempt, "attempt-1");
  assert.equal(projected.score, 8);
  assert.equal(projected.submittedAt, submittedAt);
  assert.equal(projected.projectionVersion, 1);
});

test("kernel writes can be disabled without disabling legacy workflows", () => {
  assert.equal(isAssessmentKernelWriteEnabled({ ASSESSMENT_KERNEL_WRITES: "false" }), false);
  assert.equal(isAssessmentKernelWriteEnabled({ ASSESSMENT_KERNEL_WRITES: "true" }), true);
  assert.equal(isAssessmentKernelWriteEnabled({}), true);
});
