import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateChapterMastery,
  getNextReviewAt,
  isMistakeMastered,
  masteryLabel,
} from "../lib/learning/rules.ts";

test("incorrect reviews return to the one-day interval", () => {
  const reviewedAt = new Date("2026-07-29T06:00:00.000Z");
  assert.equal(
    getNextReviewAt(reviewedAt, false, 4).toISOString(),
    "2026-07-30T06:00:00.000Z",
  );
});

test("correct reviews move through wider spaced-repetition intervals", () => {
  const reviewedAt = new Date("2026-07-29T06:00:00.000Z");
  assert.equal(
    getNextReviewAt(reviewedAt, true, 1).toISOString(),
    "2026-08-01T06:00:00.000Z",
  );
  assert.equal(
    getNextReviewAt(reviewedAt, true, 3).toISOString(),
    "2026-08-12T06:00:00.000Z",
  );
});

test("three consecutive correct reviews master a mistake", () => {
  assert.equal(isMistakeMastered(2), false);
  assert.equal(isMistakeMastered(3), true);
});

test("chapter mastery balances accuracy, practice confidence, and recency", () => {
  const now = new Date("2026-07-29T00:00:00.000Z");
  const strongScore = calculateChapterMastery({
    correctAnswers: 9,
    attempts: 10,
    lastPracticedAt: new Date("2026-07-28T00:00:00.000Z"),
    now,
  });
  const staleScore = calculateChapterMastery({
    correctAnswers: 9,
    attempts: 10,
    lastPracticedAt: new Date("2026-06-01T00:00:00.000Z"),
    now,
  });

  assert.equal(strongScore, 92);
  assert.equal(staleScore, 82);
  assert.equal(masteryLabel(strongScore, 10), "strong");
  assert.equal(masteryLabel(0, 0), "not_started");
});
