import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatRoutineTime } from "../lib/format/routine-time.ts";

test("routine times always use English digits", () => {
  assert.equal(formatRoutineTime(0), "12:00 AM");
  assert.equal(formatRoutineTime(9 * 60 + 5), "9:05 AM");
  assert.equal(formatRoutineTime(13 * 60 + 30), "1:30 PM");
});

test("routine cards use the batch-subject eligible student count", async () => {
  const source = await readFile("components/routine/RoutineDashboard.tsx", "utf8");
  const notifications = await readFile("lib/push/routine-notifications.ts", "utf8");

  assert.match(source, /item\.eligibleStudentCount \?\? item\.students\.length/);
  assert.match(notifications, /formatRoutineTime\(routine\.startMinute\)/);
});
