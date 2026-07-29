import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSubjectLevel,
  calculateSubjectXp,
  getDhakaWeekBounds,
  leaderboardScore,
  resolveStreakUpdate,
  visibleStreak,
} from "../lib/gamification/engagement-rules.ts";

test("subject XP rewards correct answers, completion, and improvement", () => {
  assert.equal(
    calculateSubjectXp({
      score: 8,
      totalQuestions: 10,
      percentage: 80,
      previousBest: 65,
    }),
    57,
  );
  assert.equal(calculateSubjectLevel(0), 1);
  assert.equal(calculateSubjectLevel(249), 1);
  assert.equal(calculateSubjectLevel(250), 2);
});

test("streak freeze protects exactly one missed day", () => {
  assert.deepEqual(
    resolveStreakUpdate({
      currentStreak: 5,
      lastQualifiedDate: "2026-07-27",
      currentDateKey: "2026-07-29",
      streakFreezes: 1,
    }),
    {
      currentStreak: 6,
      streakFreezes: 0,
      streakFreezeUsed: true,
    },
  );
  assert.equal(
    visibleStreak({
      currentStreak: 5,
      lastQualifiedDate: "2026-07-27",
      currentDateKey: "2026-07-29",
      streakFreezes: 1,
    }),
    5,
  );
});

test("streak resets after a longer gap and never spends a freeze", () => {
  assert.deepEqual(
    resolveStreakUpdate({
      currentStreak: 5,
      lastQualifiedDate: "2026-07-25",
      currentDateKey: "2026-07-29",
      streakFreezes: 2,
    }),
    {
      currentStreak: 1,
      streakFreezes: 2,
      streakFreezeUsed: false,
    },
  );
});

test("weekly bounds use the Dhaka Monday-to-Sunday calendar", () => {
  const bounds = getDhakaWeekBounds(new Date("2026-07-29T06:00:00Z"));
  assert.equal(bounds.key, "2026-07-27");
  assert.equal(bounds.start.toISOString(), "2026-07-26T18:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-08-02T17:59:59.999Z");
});

test("leaderboard values consistency and improvement over raw marks", () => {
  assert.equal(
    leaderboardScore({ activeDays: 4, questions: 100, improvement: 10 }),
    280,
  );
  assert.ok(
    leaderboardScore({ activeDays: 4, questions: 20, improvement: 0 }) >
      leaderboardScore({ activeDays: 1, questions: 40, improvement: 0 }),
  );
});
