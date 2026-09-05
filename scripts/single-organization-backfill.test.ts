import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { inferBatchStudentClass, SINGLE_ORGANIZATION_BACKFILL_ID } from "../lib/db/single-organization-backfill.ts";

test("single-organization batch class inference is explicit and conservative", () => {
  assert.equal(inferBatchStudentClass("SSC 2027"), "class-10");
  assert.equal(inferBatchStudentClass("HSC 2028"), "class-11");
  assert.equal(inferBatchStudentClass("Weekend science"), undefined);
});

test("single-organization migration is bounded and confirmation guarded", async () => {
  const source = await readFile("scripts/migrate-single-organization-scope.ts", "utf8");
  assert.match(source, /limit > 5_000/);
  assert.match(source, /Apply requires --confirm=/);
  assert.match(source, /autoIndex: false/);
  assert.ok(SINGLE_ORGANIZATION_BACKFILL_ID.includes("single_organization"));
});
