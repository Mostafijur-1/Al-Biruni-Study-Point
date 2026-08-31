import assert from "node:assert/strict";
import test from "node:test";

import { assessmentContentHash, canEditVersion, validateKernelResponses, validateLegacyIndexResponses } from "../lib/assessment-kernel.ts";

test("content hashes are stable across object key order", () => {
  assert.equal(assessmentContentHash({ b: 2, a: [1, 3] }), assessmentContentHash({ a: [1, 3], b: 2 }));
});

test("kernel responses reject duplicate and out-of-assessment questions", () => {
  assert.deepEqual(validateKernelResponses([
    { questionVersionId: "q1" }, { questionVersionId: "q1" },
  ], ["q1"]), { ok: false, code: "DUPLICATE_RESPONSE", questionVersionId: "q1" });
  assert.deepEqual(validateKernelResponses([{ questionVersionId: "q2" }], ["q1"]), {
    ok: false, code: "UNKNOWN_QUESTION", questionVersionId: "q2",
  });
});

test("legacy responses reject fractional and out-of-range option indexes", () => {
  assert.equal(validateLegacyIndexResponses([{ questionId: "q1", selectedIndex: 1.5 }], ["q1"]).ok, false);
  assert.equal(validateLegacyIndexResponses([{ questionId: "q1", selectedIndex: 4 }], ["q1"]).ok, false);
});

test("only drafts are editable", () => {
  assert.equal(canEditVersion("draft"), true);
  assert.equal(canEditVersion("published"), false);
});
