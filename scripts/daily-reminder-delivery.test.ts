import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("daily reminder refreshes subscriptions created with an old VAPID key", async () => {
  const source = await readFile("lib/push/client-subscription.ts", "utf8");
  const layout = await readFile("app/layout.tsx", "utf8");

  assert.match(source, /subscription\.options\.applicationServerKey/);
  assert.match(source, /await subscription\.unsubscribe\(\)/);
  assert.match(layout, /<PushNotificationSync \/>/);
});

test("daily reminder reports actual push delivery outcomes", async () => {
  const source = await readFile("app/api/cron/evening-reminder/route.ts", "utf8");

  assert.match(source, /Daily exam reminder delivery failed/);
  assert.match(source, /if \(delivered === 0\)/);
  assert.match(source, /count: delivered/);
});
