import assert from "node:assert/strict";
import test from "node:test";

import {
  areQuestionTextsSimilar,
  selectPracticeQuestions,
} from "../lib/mcq/practice-selection.ts";

function question(id: string, chapter: string, text = `Question ${id}`) {
  const digitWords: Record<string, string> = {
    "0": "zero",
    "1": "one",
    "2": "two",
    "3": "three",
    "4": "four",
    "5": "five",
    "6": "six",
    "7": "seven",
    "8": "eight",
    "9": "nine",
  };
  const uniqueText = [...id]
    .map((character) => digitWords[character] ?? character)
    .join(" ");
  return {
    id,
    chapter,
    question: text === `Question ${id}` ? `Question about ${uniqueText}` : text,
  };
}

const fixedRandom = () => 0.42;

test("practice selection avoids the last three attempts when alternatives exist", () => {
  const candidates = Array.from({ length: 30 }, (_, index) =>
    question(`q${index + 1}`, `chapter-${(index % 3) + 1}`),
  );
  const recentQuestionIds = ["q1", "q2", "q3", "q4", "q5", "q6"];
  const selected = selectPracticeQuestions({
    candidates,
    history: {
      seenQuestionIds: [...recentQuestionIds, "q7", "q8", "q9", "q10"],
      recentQuestionIds,
      immediateQuestionIds: ["q1", "q2"],
      incorrectQuestionIds: ["q7"],
    },
    maxQuestions: 10,
    random: fixedRandom,
  });

  assert.equal(selected.length, 10);
  assert.equal(
    selected.some((item) => recentQuestionIds.includes(item.id)),
    false,
  );
});

test("practice selection delays immediate repeats until the bank is exhausted", () => {
  const selected = selectPracticeQuestions({
    candidates: [
      question("q1", "one"),
      question("q2", "one"),
      question("q3", "two"),
      question("q4", "two"),
    ],
    history: {
      seenQuestionIds: ["q1", "q2", "q3", "q4"],
      recentQuestionIds: ["q1", "q2", "q3", "q4"],
      immediateQuestionIds: ["q1", "q2"],
      incorrectQuestionIds: [],
    },
    maxQuestions: 2,
    random: fixedRandom,
  });

  assert.deepEqual(
    new Set(selected.map((item) => item.id)),
    new Set(["q3", "q4"]),
  );
});

test("practice selection spreads unseen questions across chapters", () => {
  const candidates = ["one", "two", "three"].flatMap((chapter) =>
    Array.from({ length: 4 }, (_, index) =>
      question(`${chapter}-${index}`, chapter),
    ),
  );
  const selected = selectPracticeQuestions({
    candidates,
    history: {
      seenQuestionIds: [],
      recentQuestionIds: [],
      immediateQuestionIds: [],
      incorrectQuestionIds: [],
    },
    maxQuestions: 9,
    random: fixedRandom,
  });
  const chapterCounts = selected.reduce<Record<string, number>>(
    (counts, item) => ({
      ...counts,
      [item.chapter]: (counts[item.chapter] ?? 0) + 1,
    }),
    {},
  );

  assert.deepEqual(chapterCounts, { one: 3, two: 3, three: 3 });
});

test("question similarity recognizes lightly changed numeric duplicates", () => {
  assert.equal(
    areQuestionTextsSimilar(
      "A 10 kg object moves at 5 m/s. What is its momentum?",
      "A 20 kg object moves at 8 m/s. What is its momentum?",
    ),
    true,
  );
  assert.equal(
    areQuestionTextsSimilar(
      "What is the SI unit of force?",
      "Which organ pumps blood around the body?",
    ),
    false,
  );
});
