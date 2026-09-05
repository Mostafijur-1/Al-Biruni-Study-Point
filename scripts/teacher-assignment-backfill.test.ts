import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { TEACHER_ASSIGNMENT_BACKFILL_ID } from "../lib/db/teacher-assignment-backfill.ts";

test("teacher assignment migration is bounded, private, and confirmation guarded", async () => {
  const source = await readFile("scripts/migrate-teacher-assignments.ts", "utf8");
  assert.match(source, /limit > 500/);
  assert.match(source, /Apply requires --confirm=/);
  assert.match(source, /autoIndex: false/);
  assert.ok(TEACHER_ASSIGNMENT_BACKFILL_ID.includes("teacher_assignments"));
});
