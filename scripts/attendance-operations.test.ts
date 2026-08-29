import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getDhakaRoutineOccurrence } from "../lib/attendance-occurrence.ts";
import { areAttendanceWritesEnabled } from "../lib/attendance-rules.ts";

test("attendance activation is narrow and does not unlock other academic writes", () => {
  assert.equal(areAttendanceWritesEnabled(undefined, "true"), true);
  assert.equal(areAttendanceWritesEnabled("true", undefined), false);
});

test("routine attendance creates the correct Dhaka-day UTC occurrence", () => {
  const occurrence = getDhakaRoutineOccurrence(
    { weekday: 6, startMinute: 9 * 60, endMinute: 10 * 60 + 30 },
    new Date("2026-08-29T03:15:00.000Z"),
  );

  assert.equal(occurrence?.scheduledStart.toISOString(), "2026-08-29T03:00:00.000Z");
  assert.equal(occurrence?.scheduledEnd.toISOString(), "2026-08-29T04:30:00.000Z");
  assert.equal(
    getDhakaRoutineOccurrence(
      { weekday: 5, startMinute: 9 * 60, endMinute: 10 * 60 },
      new Date("2026-08-29T03:15:00.000Z"),
    ),
    null,
  );
});

test("teacher attendance is routine-owned and exposes P A L E controls", async () => {
  const service = await readFile("lib/attendance-service.ts", "utf8");
  const workspace = await readFile("components/attendance/TeacherAttendanceWorkspace.tsx", "utf8");
  const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
    env?: Record<string, string>;
  };

  assert.match(service, /assertAttendanceManager\(input\.actor, routine\.teacherId/);
  assert.match(service, /batchId: routine\.batchId/);
  assert.match(service, /subjectId: routine\.subjectId/);
  assert.match(workspace, /action: "open-routine"/);
  for (const label of ["P", "A", "L", "E"]) {
    assert.match(workspace, new RegExp(`label: "${label}"`));
  }
  assert.equal(config.env?.ATTENDANCE_WRITES_ENABLED, "true");
});
