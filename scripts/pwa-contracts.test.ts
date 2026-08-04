import assert from "node:assert/strict";
import test from "node:test";

import {
  getPwaEventKey,
  getTelemetryExpiry,
  hashNetworkIdentifier,
  pwaSubscriptionSchema,
  pwaTrackSchema,
  truncateUserAgent,
} from "../lib/pwa-contracts.ts";

test("accepts bounded legacy and UUID-style PWA device IDs", () => {
  assert.equal(
    pwaTrackSchema.parse({ deviceId: "abc123def456ghi789", type: "launch" }).type,
    "launch",
  );
  assert.equal(
    pwaTrackSchema.parse({ deviceId: "123e4567-e89b-12d3-a456-426614174000", type: "install" }).type,
    "install",
  );
});

test("rejects insecure push endpoints and oversized identifiers", () => {
  assert.equal(
    pwaSubscriptionSchema.safeParse({
      deviceId: "abc123def456ghi789",
      subscription: {
        endpoint: "http://example.com/push",
        expirationTime: null,
        keys: { p256dh: "1234567890123456", auth: "12345678" },
      },
    }).success,
    false,
  );
  assert.equal(
    pwaTrackSchema.safeParse({ deviceId: "x".repeat(129), type: "launch" }).success,
    false,
  );
});

test("deduplicates installs globally and launches by UTC day", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");
  assert.equal(getPwaEventKey("install", now), "install");
  assert.equal(getPwaEventKey("launch", now), "launch:2026-08-04");
});

test("hashes network identifiers and bounds retained metadata", () => {
  const first = hashNetworkIdentifier("203.0.113.5", "test-secret");
  const second = hashNetworkIdentifier("203.0.113.5", "test-secret");
  assert.equal(first, second);
  assert.notEqual(first, "203.0.113.5");
  assert.equal(first.length, 64);
  assert.equal(truncateUserAgent("x".repeat(500))?.length, 300);
  assert.equal(
    getTelemetryExpiry(new Date("2026-08-04T00:00:00.000Z"), 90).toISOString(),
    "2026-11-02T00:00:00.000Z",
  );
});
