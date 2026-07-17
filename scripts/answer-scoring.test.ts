import assert from "node:assert/strict";
import test from "node:test";

import {
  dedupeSubmittedAnswers,
  scoreSubmittedAnswers,
} from "../lib/mcq/answer-scoring.ts";

test("uses only the final answer when a question is submitted more than once", () => {
  const answers = dedupeSubmittedAnswers([
    { questionId: "q1", selectedIndex: 0 },
    { questionId: "q1", selectedIndex: 2 },
  ]);

  assert.deepEqual(answers, [{ questionId: "q1", selectedIndex: 2 }]);
});

test("prevents duplicate answers from inflating an exam score", () => {
  const result = scoreSubmittedAnswers(
    [
      { questionId: "q1", selectedIndex: 2 },
      { questionId: "q1", selectedIndex: 2 },
      { questionId: "q2", selectedIndex: null },
    ],
    [
      { id: "q1", correctIndex: 2, marks: 5 },
      { id: "q2", correctIndex: 1, marks: 3 },
    ],
  );

  assert.equal(result.score, 5);
  assert.equal(result.records.length, 2);
});

test("reports question IDs that do not belong to the exam", () => {
  const result = scoreSubmittedAnswers(
    [{ questionId: "foreign-question", selectedIndex: 0 }],
    [{ id: "q1", correctIndex: 0 }],
  );

  assert.deepEqual(result.invalidQuestionIds, ["foreign-question"]);
  assert.equal(result.score, 0);
});
