import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCircuitValues,
  calculateMolarMass,
  calculateMotionDistance,
  validateLabMastery,
} from "../lib/labs/rules.ts";

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
