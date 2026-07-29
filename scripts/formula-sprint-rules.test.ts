import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFormulaSprintReward,
  calculateFormulaStreak,
  formulaConfidencePercent,
  selectFormulaCardIds,
} from "../lib/formulas/rules.ts";

test("formula selection prioritizes unseen cards and returns no duplicates", () => {
  const selected = selectFormulaCardIds({
    cardIds: ["a", "b", "c", "d", "e", "f"],
    history: [
      {
        dateKey: "2026-07-28",
        answers: [{ cardId: "a", confidence: "again" }],
      },
    ],
    dateKey: "2026-07-29",
    count: 5,
  });

  assert.equal(selected.length, 5);
  assert.equal(new Set(selected).size, 5);
  assert.equal(selected.includes("a"), false);
});

test("formula selection returns weaker reviewed cards before stronger ones", () => {
  const selected = selectFormulaCardIds({
    cardIds: ["weak", "strong"],
    history: [
      {
        dateKey: "2026-07-27",
        answers: [
          { cardId: "weak", confidence: "again" },
          { cardId: "strong", confidence: "easy" },
        ],
      },
    ],
    dateKey: "2026-07-29",
    count: 2,
  });
  assert.deepEqual(selected, ["weak", "strong"]);
});

test("formula sprint reward values completion and recall confidence", () => {
  assert.deepEqual(
    calculateFormulaSprintReward([
      { confidence: "again" },
      { confidence: "good" },
      { confidence: "good" },
      { confidence: "easy" },
      { confidence: "easy" },
    ]),
    {
      xp: 15,
      breakdown: { completion: 5, recalled: 4, confident: 6 },
    },
  );
  assert.equal(calculateFormulaSprintReward([]).xp, 0);
});

test("formula confidence and streak summarize daily recall", () => {
  assert.equal(
    formulaConfidencePercent([
      { confidence: "again" },
      { confidence: "good" },
      { confidence: "easy" },
    ]),
    50,
  );
  assert.equal(
    calculateFormulaStreak(
      ["2026-07-29", "2026-07-28", "2026-07-27"],
      "2026-07-29",
    ),
    3,
  );
  assert.equal(
    calculateFormulaStreak(["2026-07-28", "2026-07-27"], "2026-07-29"),
    2,
  );
  assert.equal(
    calculateFormulaStreak(["2026-07-25"], "2026-07-29"),
    0,
  );
});
