import assert from "node:assert/strict";
import test from "node:test";

import {
  nextSessionVersion,
  normalizeSessionVersion,
  sessionVersionFilter,
  sessionVersionMatches,
} from "../lib/auth/session-version.ts";

test("normalizes legacy and invalid session versions to zero", () => {
  assert.equal(normalizeSessionVersion(undefined), 0);
  assert.equal(normalizeSessionVersion(null), 0);
  assert.equal(normalizeSessionVersion(-1), 0);
  assert.equal(normalizeSessionVersion(1.5), 0);
  assert.equal(normalizeSessionVersion(4), 4);
});

test("matches legacy tokens and detects revoked sessions", () => {
  assert.equal(sessionVersionMatches(undefined, undefined), true);
  assert.equal(sessionVersionMatches(undefined, 0), true);
  assert.equal(sessionVersionMatches(2, 2), true);
  assert.equal(sessionVersionMatches(2, 3), false);
  assert.equal(nextSessionVersion(2), 3);
});

test("supports legacy database rows in the zero-version compare-and-swap filter", () => {
  assert.deepEqual(sessionVersionFilter(0), {
    $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }],
  });
  assert.deepEqual(sessionVersionFilter(3), { sessionVersion: 3 });
});
