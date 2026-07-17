import assert from "node:assert/strict";
import test from "node:test";

import { parseCorrectIndex } from "../lib/mcq/correct-index.ts";

test("accepts only integer option indexes from zero through three", () => {
  for (const value of [0, 1, 2, 3, "0", " 2 "]) {
    assert.notEqual(parseCorrectIndex(value), null);
  }
});

test("rejects missing, fractional, and out-of-range answers", () => {
  for (const value of [undefined, null, "", "1st", -1, 4, 1.5, Number.NaN]) {
    assert.equal(parseCorrectIndex(value), null);
  }
});
