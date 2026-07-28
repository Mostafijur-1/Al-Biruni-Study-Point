import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLevel,
  calculatePracticeReward,
  differenceInDateKeys,
  getDhakaDateKey,
  getEarnedAchievementCodes,
} from "../lib/gamification/rules.ts";

test("calculates practice XP from correct answers, completion, and accuracy", () => {
  const reward = calculatePracticeReward({
    score: 8,
    totalQuestions: 10,
    answeredCount: 10,
    isCancelled: false,
  });

  assert.equal(reward.rawXp, 36);
  assert.equal(reward.qualifiedDay, true);
  assert.deepEqual(reward.breakdown, {
    correctAnswers: 16,
    completion: 10,
    accuracy: 10,
  });
});

test("cancelled practice attempts never earn XP or qualify a streak day", () => {
  const reward = calculatePracticeReward({
    score: 10,
    totalQuestions: 10,
    answeredCount: 10,
    isCancelled: true,
  });

  assert.equal(reward.rawXp, 0);
  assert.equal(reward.qualifiedDay, false);
});

test("levels advance every 100 XP", () => {
  assert.equal(calculateLevel(0), 1);
  assert.equal(calculateLevel(99), 1);
  assert.equal(calculateLevel(100), 2);
  assert.equal(calculateLevel(250), 3);
});

test("Dhaka date keys respect the local calendar boundary", () => {
  assert.equal(getDhakaDateKey(new Date("2026-07-28T17:59:59Z")), "2026-07-28");
  assert.equal(getDhakaDateKey(new Date("2026-07-28T18:00:00Z")), "2026-07-29");
  assert.equal(differenceInDateKeys("2026-07-28", "2026-07-29"), 1);
});

test("achievement rules recognize meaningful milestones", () => {
  const codes = getEarnedAchievementCodes({
    testsCompleted: 4,
    totalQuestionsAnswered: 100,
    currentStreak: 3,
    score: 10,
    totalQuestions: 10,
    answeredCount: 10,
  });

  assert.deepEqual(codes, [
    "FIRST_TEST",
    "THREE_DAY_STREAK",
    "HUNDRED_QUESTIONS",
    "SHARP_SHOOTER",
    "PERFECT_SCORE",
  ]);
});
