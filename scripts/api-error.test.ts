import assert from "node:assert/strict";
import test from "node:test";

import { apiErrorCodeForStatus, createRequestId } from "../lib/api-error.ts";

test("maps common HTTP statuses to stable API error codes", () => {
  assert.equal(apiErrorCodeForStatus(400), "BAD_REQUEST");
  assert.equal(apiErrorCodeForStatus(401), "UNAUTHENTICATED");
  assert.equal(apiErrorCodeForStatus(403), "FORBIDDEN");
  assert.equal(apiErrorCodeForStatus(404), "NOT_FOUND");
  assert.equal(apiErrorCodeForStatus(409), "CONFLICT");
  assert.equal(apiErrorCodeForStatus(429), "RATE_LIMITED");
  assert.equal(apiErrorCodeForStatus(500), "INTERNAL_ERROR");
});

test("creates opaque UUID request identifiers", () => {
  const first = createRequestId();
  const second = createRequestId();

  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(first, second);
});
