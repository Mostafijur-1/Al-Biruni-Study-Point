import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_IMAGE_SIZE_BYTES,
  validateImageFile,
} from "../lib/image-validation.ts";

test("accepts JPEG, PNG, and WebP signatures", async () => {
  const files = [
    new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "question.jpg", {
      type: "image/jpeg",
    }),
    new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "question.png",
      { type: "image/png" },
    ),
    new File(
      [new TextEncoder().encode("RIFF0000WEBP")],
      "question.webp",
      { type: "image/webp" },
    ),
  ];

  for (const file of files) {
    assert.deepEqual(await validateImageFile(file), { ok: true });
  }
});

test("rejects unsupported and disguised files", async () => {
  const unsupported = new File([new Uint8Array([0x47, 0x49, 0x46])], "question.gif", {
    type: "image/gif",
  });
  const disguised = new File([new TextEncoder().encode("not a png")], "question.png", {
    type: "image/png",
  });

  assert.equal((await validateImageFile(unsupported)).ok, false);
  assert.equal((await validateImageFile(disguised)).ok, false);
});

test("rejects images larger than the server limit", async () => {
  const oversized = new File(
    [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
    "large.jpg",
    { type: "image/jpeg" },
  );

  const result = await validateImageFile(oversized);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});
