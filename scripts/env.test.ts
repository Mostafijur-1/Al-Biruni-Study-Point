import assert from "node:assert/strict";
import test from "node:test";

import { getIntegerEnv } from "../lib/env.ts";

test("integer environment settings use their fallback when absent", () => {
  const name = "ABSP_TEST_INTEGER_ENV_ABSENT";
  delete process.env[name];

  assert.equal(getIntegerEnv(name, 10, { min: 1, max: 100 }), 10);
});

test("integer environment settings accept bounded integer values", () => {
  const name = "ABSP_TEST_INTEGER_ENV_VALID";
  process.env[name] = " 24 ";

  try {
    assert.equal(getIntegerEnv(name, 10, { min: 1, max: 100 }), 24);
  } finally {
    delete process.env[name];
  }
});

test("integer environment settings reject invalid or unsafe values", () => {
  const name = "ABSP_TEST_INTEGER_ENV_INVALID";

  try {
    for (const value of ["0", "101", "1.5", "not-a-number"]) {
      process.env[name] = value;
      assert.throws(
        () => getIntegerEnv(name, 10, { min: 1, max: 100 }),
        new RegExp(`${name} must be an integer`),
      );
    }
  } finally {
    delete process.env[name];
  }
});
