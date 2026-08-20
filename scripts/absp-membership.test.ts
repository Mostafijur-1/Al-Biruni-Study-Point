import assert from "node:assert/strict";
import test from "node:test";

import { adminUpdateUserSchema } from "../lib/validations/admin.schema.ts";

test("admin can explicitly include or exclude an ABSP member", () => {
  assert.equal(adminUpdateUserSchema.parse({ isAbspMember: true }).isAbspMember, true);
  assert.equal(adminUpdateUserSchema.parse({ isAbspMember: false }).isAbspMember, false);
});

test("ABSP membership remains an explicit admin mutation", () => {
  assert.equal(adminUpdateUserSchema.safeParse({}).success, false);
});
