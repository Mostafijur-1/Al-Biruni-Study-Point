import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("orphan result quarantine is bounded, transactional, and confirmation guarded", () => {
  const runner = readFileSync("scripts/quarantine-orphan-practice-results.ts", "utf8");
  const migration = readFileSync("lib/db/orphan-practice-result-quarantine.ts", "utf8");
  assert.match(runner, /limit > 500/);
  assert.match(runner, /Apply requires --confirm=/);
  assert.match(migration, /withTransaction/);
  assert.match(migration, /legacyorphanrecords/);
  assert.match(migration, /removal\.deletedCount/);
});
