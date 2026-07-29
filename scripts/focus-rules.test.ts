import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFocusReward,
  calculateFocusStreak,
  isFocusCompletionEligible,
} from "../lib/focus/rules.ts";

test("focus completion allows the small timer grace but rejects earlier attempts", () => {
  const startedAt = new Date("2026-07-29T06:00:00.000Z");

  assert.equal(
    isFocusCompletionEligible({
      startedAt,
      durationMinutes: 15,
      now: new Date("2026-07-29T06:14:50.000Z"),
    }),
    true,
  );
  assert.equal(
    isFocusCompletionEligible({
      startedAt,
      durationMinutes: 15,
      now: new Date("2026-07-29T06:14:49.000Z"),
    }),
    false,
  );
});

test("focus reward follows session minutes and respects the daily XP cap", () => {
  assert.equal(
    calculateFocusReward({ durationMinutes: 25, xpEarnedToday: 0 }),
    25,
  );
  assert.equal(
    calculateFocusReward({ durationMinutes: 45, xpEarnedToday: 30 }),
    30,
  );
  assert.equal(
    calculateFocusReward({ durationMinutes: 15, xpEarnedToday: 60 }),
    0,
  );
});

test("focus streak accepts today or yesterday and stops at a gap", () => {
  assert.equal(
    calculateFocusStreak(
      ["2026-07-29", "2026-07-28", "2026-07-27"],
      "2026-07-29",
    ),
    3,
  );
  assert.equal(
    calculateFocusStreak(
      ["2026-07-28", "2026-07-27", "2026-07-26"],
      "2026-07-29",
    ),
    3,
  );
  assert.equal(
    calculateFocusStreak(
      ["2026-07-29", "2026-07-27", "2026-07-26"],
      "2026-07-29",
    ),
    1,
  );
  assert.equal(calculateFocusStreak(["2026-07-25"], "2026-07-29"), 0);
});
