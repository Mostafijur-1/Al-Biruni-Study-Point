import assert from "node:assert/strict";
import test from "node:test";

import {
  areAcademicWritesEnabled,
  canTransitionAcademicLifecycle,
  hasEnrollmentCapacity,
  isEffectiveOn,
  isValidDateRange,
  isValidRoutineWindow,
} from "../lib/academic-rules.ts";

test("academic writes require an explicit true feature flag", () => {
  assert.equal(areAcademicWritesEnabled(undefined), false);
  assert.equal(areAcademicWritesEnabled("false"), false);
  assert.equal(areAcademicWritesEnabled(" true "), true);
});

test("academic lifecycle prevents reopening closed or archived records", () => {
  assert.equal(canTransitionAcademicLifecycle("planned", "active"), true);
  assert.equal(canTransitionAcademicLifecycle("active", "closed"), true);
  assert.equal(canTransitionAcademicLifecycle("closed", "active"), false);
  assert.equal(canTransitionAcademicLifecycle("archived", "active"), false);
});

test("date and routine windows require a positive duration", () => {
  const start = new Date("2026-01-01T00:00:00.000Z");
  const end = new Date("2026-12-31T00:00:00.000Z");
  assert.equal(isValidDateRange(start, end), true);
  assert.equal(isValidDateRange(end, start), false);
  assert.equal(isValidRoutineWindow(9 * 60, 10 * 60), true);
  assert.equal(isValidRoutineWindow(10 * 60, 9 * 60), false);
  assert.equal(isValidRoutineWindow(-1, 60), false);
});

test("capacity and effective-date rules are boundary safe", () => {
  assert.equal(hasEnrollmentCapacity(30, 29), true);
  assert.equal(hasEnrollmentCapacity(30, 30), false);
  assert.equal(hasEnrollmentCapacity(0, 0), false);

  const from = new Date("2026-01-01T00:00:00.000Z");
  const to = new Date("2026-06-30T23:59:59.000Z");
  assert.equal(isEffectiveOn(from, to, new Date("2026-04-01T00:00:00.000Z")), true);
  assert.equal(isEffectiveOn(from, to, new Date("2026-07-01T00:00:00.000Z")), false);
});
