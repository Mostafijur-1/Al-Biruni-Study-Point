import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
  crons: Array<{ path: string; schedule: string }>;
};

test("Vercel Hobby cron jobs run no more than once per day", () => {
  assert.equal(config.crons.length, 1);
  for (const cron of config.crons) {
    const [minute, hour] = cron.schedule.trim().split(/\s+/);
    assert.match(minute, /^\d+$/);
    assert.match(hour, /^\d+$/);
  }
});

test("the single daily cron delivers the exam reminder at 8 PM Dhaka time", () => {
  assert.deepEqual(config.crons, [{
    path: "/api/cron/evening-reminder",
    schedule: "0 14 * * *",
  }]);
});
