import assert from "node:assert/strict";
import test from "node:test";

import { resolveAcademicBatchReadScope } from "../lib/academic-scope.ts";

test("admins can read all batches while teachers and students are assignment scoped", () => {
  assert.deepEqual(resolveAcademicBatchReadScope("admin", [], []), { kind: "all" });
  assert.deepEqual(resolveAcademicBatchReadScope("teacher", ["batch-a", "batch-a"], []), {
    kind: "assigned",
    batchIds: ["batch-a"],
  });
  assert.deepEqual(resolveAcademicBatchReadScope("student", [], ["batch-b"]), {
    kind: "assigned",
    batchIds: ["batch-b"],
  });
});

test("missing assignments default to an empty batch scope", () => {
  assert.deepEqual(resolveAcademicBatchReadScope("teacher", [], []), {
    kind: "assigned",
    batchIds: [],
  });
  assert.deepEqual(resolveAcademicBatchReadScope("student", [], []), {
    kind: "assigned",
    batchIds: [],
  });
});
