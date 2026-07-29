import assert from "node:assert/strict";
import test from "node:test";

import {
  SCIENCE_LAB_IDS,
  calculateLabResult,
  calculateCircuitValues,
  calculateMolarMass,
  calculateMotionDistance,
  getScienceLabsForLevel,
  validateLabMastery,
} from "../lib/labs/rules.ts";
import { getSyllabusChapters } from "../lib/content/syllabus.ts";
import {
  CONCEPT_VIEW_LABELS,
  LAB_CONCEPTS,
} from "../lib/labs/concepts.ts";

test("science lab formulas return expected physical values", () => {
  assert.equal(calculateMotionDistance(12, 5), 60);
  assert.deepEqual(calculateCircuitValues(12, 6), {
    current: 2,
    power: 24,
  });
  assert.equal(calculateMolarMass(2, 18), 36);
});

test("motion mastery accepts valid combinations and rejects invalid ranges", () => {
  assert.deepEqual(
    validateLabMastery("motion", { velocity: 12, time: 5 }),
    { valid: true, result: 60 },
  );
  assert.equal(
    validateLabMastery("motion", { velocity: 10, time: 5 }).valid,
    false,
  );
  assert.equal(
    validateLabMastery("motion", { velocity: 30, time: 2 }).valid,
    false,
  );
});

test("circuit mastery requires two amperes within valid controls", () => {
  assert.equal(
    validateLabMastery("circuit", { voltage: 12, resistance: 6 }).valid,
    true,
  );
  assert.equal(
    validateLabMastery("circuit", { voltage: 9, resistance: 6 }).valid,
    false,
  );
});

test("mole mastery requires 36 grams of water", () => {
  assert.equal(
    validateLabMastery("mole", { moles: 2, molarMass: 18 }).valid,
    true,
  );
  assert.equal(
    validateLabMastery("mole", { moles: 2, molarMass: 44 }).valid,
    false,
  );
  assert.equal(
    validateLabMastery("mole", { moles: 2.25, molarMass: 18 }).valid,
    false,
  );
});

test("expanded lab missions validate force, atom, binary, and probability", () => {
  assert.equal(
    validateLabMastery("force", { mass: 6, acceleration: 4 }).valid,
    true,
  );
  assert.equal(
    validateLabMastery("atom", { protons: 8, neutrons: 8, electrons: 8 })
      .valid,
    true,
  );
  assert.equal(
    validateLabMastery("atom", { protons: 7, neutrons: 9, electrons: 7 })
      .valid,
    false,
  );
  assert.equal(
    validateLabMastery("binary", {
      bit32: 1,
      bit16: 0,
      bit8: 1,
      bit4: 0,
      bit2: 1,
      bit1: 0,
    }).valid,
    true,
  );
  assert.equal(
    validateLabMastery("probability", { favorable: 8, total: 6 }).valid,
    false,
  );
  assert.equal(
    calculateLabResult("network", { fileSize: 100, bandwidth: 80 }),
    10,
  );
});

test("every class-aware lab maps to a real syllabus subject and chapter", () => {
  assert.equal(SCIENCE_LAB_IDS.length, 18);

  for (const level of ["ssc", "hsc"] as const) {
    const labs = getScienceLabsForLevel(level);
    assert.equal(new Set(labs.map((lab) => lab.family)).size, 4);

    for (const lab of labs) {
      assert.equal(
        getSyllabusChapters(level, lab.subject).includes(lab.chapter),
        true,
        `${level}: ${lab.subject} / ${lab.chapter} is missing from syllabus`,
      );
    }
  }
});

test("every lab includes a complete concept-first visualization guide", () => {
  assert.deepEqual(Object.keys(CONCEPT_VIEW_LABELS), [
    "mechanism",
    "relationship",
    "misconception",
  ]);
  assert.deepEqual(Object.keys(LAB_CONCEPTS).sort(), [...SCIENCE_LAB_IDS].sort());

  for (const labId of SCIENCE_LAB_IDS) {
    const concept = LAB_CONCEPTS[labId];
    assert.ok(concept.question.length > 20, `${labId} needs a concept question`);
    assert.ok(concept.mechanism.length > 40, `${labId} needs mechanism detail`);
    assert.ok(
      concept.relationship.length > 40,
      `${labId} needs cause-effect detail`,
    );
    assert.ok(
      concept.misconception.length > 30,
      `${labId} needs misconception detail`,
    );
    assert.equal(concept.steps.length, 3);
  }
});
