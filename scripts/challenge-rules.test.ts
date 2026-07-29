import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateChallengeStreak,
  calculateDailyChallengeReward,
} from "../lib/challenge/rules.ts";

test("daily challenge reward values completion, correctness, speed, and mastery", () => {
  assert.deepEqual(
    calculateDailyChallengeReward({
      score: 5,
      totalQuestions: 5,
      timeTakenSeconds: 40,
    }),
    {
      xp: 50,
      breakdown: {
        completion: 10,
        correctAnswers: 20,
        speed: 10,
        perfect: 10,
      },
    },
  );
  assert.equal(
    calculateDailyChallengeReward({
      score: 2,
      totalQuestions: 5,
      timeTakenSeconds: 70,
    }).xp,
    18,
  );
});

test("challenge streak accepts today or yesterday as the latest completion", () => {
  assert.equal(
    calculateChallengeStreak(
      ["2026-07-29", "2026-07-28", "2026-07-27"],
      "2026-07-29",
    ),
    3,
  );
  assert.equal(
    calculateChallengeStreak(
      ["2026-07-28", "2026-07-27", "2026-07-26"],
      "2026-07-29",
    ),
    3,
  );
});

test("challenge streak stops at a missed day", () => {
  assert.equal(
    calculateChallengeStreak(
      ["2026-07-29", "2026-07-27", "2026-07-26"],
      "2026-07-29",
    ),
    1,
  );
  assert.equal(
    calculateChallengeStreak(["2026-07-25"], "2026-07-29"),
    0,
  );
});
