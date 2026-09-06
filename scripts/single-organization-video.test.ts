import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SINGLE_ORGANIZATION_VIDEO_ID } from "../lib/db/single-organization-video-backfill.ts";

test("single-organization Numpy video migration is exact and confirmation guarded", async () => {
  const [runner, migration] = await Promise.all([
    readFile("scripts/migrate-single-organization-video.ts", "utf8"),
    readFile("lib/db/single-organization-video-backfill.ts", "utf8"),
  ]);
  assert.match(runner, /Apply requires --confirm=/);
  assert.match(runner, /autoIndex: false/);
  assert.match(migration, /title: \/\^\\s\*numpy\\s\*\$\/i/);
  assert.match(migration, /code: "ICT"/);
  assert.match(migration, /videos\.length > 1/);
  assert.ok(SINGLE_ORGANIZATION_VIDEO_ID.includes("numpy_video"));
});
