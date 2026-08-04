import assert from "node:assert/strict";
import test from "node:test";

import { validateExamForPublication } from "../lib/mcq/exam-invariants.ts";

test("requires at least one question", () => {
  assert.equal(
    validateExamForPublication({
      configuredTotalMarks: 1,
      passMark: 1,
      questions: [],
    }).ok,
    false,
  );
});

test("rejects zero or negative question marks", () => {
  const result = validateExamForPublication({
    configuredTotalMarks: 1,
    passMark: 1,
    questions: [{ marks: 0 }],
  });
  assert.deepEqual(result.ok ? null : result.code, "INVALID_QUESTION_MARKS");
});

test("requires configured total to equal the question total", () => {
  const result = validateExamForPublication({
    configuredTotalMarks: 10,
    passMark: 3,
    questions: [{ marks: 2 }, { marks: 3 }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.derivedTotalMarks, 5);
});

test("requires pass mark within the derived total", () => {
  const result = validateExamForPublication({
    configuredTotalMarks: 5,
    passMark: 6,
    questions: [{ marks: 2 }, { marks: 3 }],
  });
  assert.deepEqual(result.ok ? null : result.code, "PASS_MARK_OUT_OF_RANGE");
});

test("returns the reproducible question count and total", () => {
  assert.deepEqual(
    validateExamForPublication({
      configuredTotalMarks: 5,
      passMark: 3,
      questions: [{ marks: 2 }, { marks: 3 }],
    }),
    { ok: true, questionCount: 2, totalMarks: 5 },
  );
});
