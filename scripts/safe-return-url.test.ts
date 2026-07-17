import assert from "node:assert/strict";
import test from "node:test";

import {
  isReturnPathAllowedForRole,
  sanitizeLocalReturnUrl,
} from "../lib/auth/safe-return-url.ts";

test("accepts local application return URLs", () => {
  assert.equal(sanitizeLocalReturnUrl("/student/practice?level=SSC"), "/student/practice?level=SSC");
  assert.equal(sanitizeLocalReturnUrl("/teacher/exams"), "/teacher/exams");
});

test("rejects external, ambiguous, and authentication-loop return URLs", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "/student/login",
    "/register/teacher",
  ]) {
    assert.equal(sanitizeLocalReturnUrl(value), null);
  }
});

test("keeps post-login redirects inside the authenticated role", () => {
  assert.equal(isReturnPathAllowedForRole("student", "/student/practice"), true);
  assert.equal(isReturnPathAllowedForRole("student", "/teacher/exams"), false);
  assert.equal(isReturnPathAllowedForRole("teacher", "/teacher/exams"), true);
  assert.equal(isReturnPathAllowedForRole("teacher", "/admin"), false);
  assert.equal(isReturnPathAllowedForRole("admin", "/admin/users"), true);
  assert.equal(isReturnPathAllowedForRole("admin", "/student"), false);
});
