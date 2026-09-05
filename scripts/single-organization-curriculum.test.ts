import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SINGLE_ORGANIZATION_CURRICULUM_ID } from "../lib/db/single-organization-curriculum-backfill.ts";

test("single-organization curriculum migration is bounded and confirmation guarded", async () => {
  const source = await readFile("scripts/migrate-single-organization-curriculum.ts", "utf8");
  assert.match(source, /limit > 5_000/);
  assert.match(source, /Apply requires --confirm=/);
  assert.match(source, /autoIndex: false/);
  assert.ok(SINGLE_ORGANIZATION_CURRICULUM_ID.includes("curriculum"));
});
