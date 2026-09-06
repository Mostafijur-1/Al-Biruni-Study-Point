import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HISTORICAL_PRACTICE_ATTEMPT_ID } from "../lib/db/historical-practice-attempt-backfill.ts";

test("historical practice attempt migration is bounded, deterministic, and guarded", () => {
  const runner = readFileSync("scripts/migrate-historical-practice-attempts.ts", "utf8");
  const migration = readFileSync("lib/db/historical-practice-attempt-backfill.ts", "utf8");
  assert.match(runner, /limit > 5_000/);
  assert.match(runner, /Apply requires --confirm=/);
  assert.match(migration, /createHash/);
  assert.match(migration, /legacySource: \{ collection: "PracticeResult"/);
  assert.ok(HISTORICAL_PRACTICE_ATTEMPT_ID.includes("historical_practice_attempts"));
});
