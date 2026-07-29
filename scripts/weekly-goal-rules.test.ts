import assert from "node:assert/strict";
import test from "node:test";

import {
  getWeeklyGoalReward,
  goalProgressPercent,
  isStretchWeeklyGoal,
  isWeeklyGoalComplete,
} from "../lib/goals/rules.ts";

test("weekly goals accept only configured target and reward pairs", () => {
  assert.equal(getWeeklyGoalReward("practice_questions", 30), 30);
  assert.equal(getWeeklyGoalReward("practice_questions", 100), 70);
  assert.equal(getWeeklyGoalReward("focus_minutes", 100), 50);
  assert.equal(getWeeklyGoalReward("challenge_days", 7), 80);
  assert.equal(getWeeklyGoalReward("challenge_days", 6), null);
});

test("weekly goal progress is rounded and safely capped", () => {
  assert.equal(goalProgressPercent(0, 30), 0);
  assert.equal(goalProgressPercent(14, 30), 47);
  assert.equal(goalProgressPercent(45, 30), 100);
  assert.equal(goalProgressPercent(-5, 30), 0);
  assert.equal(goalProgressPercent(10, 0), 0);
});

test("weekly goals complete at the target and identify stretch choices", () => {
  assert.equal(isWeeklyGoalComplete(29, 30), false);
  assert.equal(isWeeklyGoalComplete(30, 30), true);
  assert.equal(isWeeklyGoalComplete(45, 30), true);
  assert.equal(isWeeklyGoalComplete(0, 0), false);
  assert.equal(isStretchWeeklyGoal("focus_minutes", 180), true);
  assert.equal(isStretchWeeklyGoal("focus_minutes", 100), false);
});
