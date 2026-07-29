import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseCoachRecommendation,
  type CoachSignals,
} from "../lib/coach/rules.ts";

const emptySignals: CoachSignals = {
  dueMistakes: 0,
  challengePending: false,
  formulaPending: false,
  weeklyGoal: null,
  weakChapter: null,
  nextLab: null,
};

test("coach prioritizes due mistake review when revision is requested", () => {
  const recommendation = chooseCoachRecommendation({
    availableMinutes: 15,
    energy: "low",
    intent: "revise",
    signals: { ...emptySignals, dueMistakes: 8, formulaPending: true },
  });
  assert.equal(recommendation.key, "due-mistakes");
  assert.equal(recommendation.href, "/student/mistakes?due=1");
});

test("coach chooses a focus session for explicit focus intent and enough time", () => {
  const recommendation = chooseCoachRecommendation({
    availableMinutes: 30,
    energy: "high",
    intent: "focus",
    signals: emptySignals,
  });
  assert.equal(recommendation.key, "focus-session");
  assert.equal(recommendation.estimatedMinutes, 25);
});

test("coach keeps recommendations inside the available time", () => {
  const recommendation = chooseCoachRecommendation({
    availableMinutes: 5,
    energy: "steady",
    intent: "explore",
    signals: {
      ...emptySignals,
      formulaPending: true,
      nextLab: { title: "গতি গবেষণাগার", href: "/student/labs" },
    },
  });
  assert.equal(recommendation.key, "formula-sprint");
  assert.ok(recommendation.estimatedMinutes <= 5);
});

test("coach uses the weekly goal when automatic guidance has no urgent review", () => {
  const recommendation = chooseCoachRecommendation({
    availableMinutes: 15,
    energy: "steady",
    intent: "auto",
    signals: {
      ...emptySignals,
      weeklyGoal: {
        title: "পদার্থবিজ্ঞান: প্রশ্ন অনুশীলন",
        href: "/student/practice",
        remaining: 20,
        unit: "প্রশ্ন",
      },
    },
  });
  assert.equal(recommendation.key, "weekly-goal");
});
