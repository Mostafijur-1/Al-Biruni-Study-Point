import assert from "node:assert/strict";
import test from "node:test";

import { compareTeacherScopeParity } from "../lib/academic-scope-parity.ts";

test("scope parity matches canonical subject aliases and normalized identifiers", () => {
  const result = compareTeacherScopeParity(
    {
      classes: ["class-9"],
      subjects: ["Physics"],
      students: ["STUDENT-A"],
    },
    {
      classes: ["class-9"],
      subjects: [{ key: "PHY", aliases: ["Physics", "পদার্থবিজ্ঞান"] }],
      students: ["student-a"],
    },
  );

  assert.equal(result.status, "match");
});

test("scope parity reports both canonical-only and legacy-only access", () => {
  const result = compareTeacherScopeParity(
    { classes: ["class-10"], subjects: ["Chemistry"], students: ["legacy-student"] },
    {
      classes: ["class-9"],
      subjects: [{ key: "PHY", aliases: ["Physics"] }],
      students: ["canonical-student"],
    },
  );

  assert.equal(result.status, "mismatch");
  assert.deepEqual(result.differences.canonicalOnlyClasses, ["class-9"]);
  assert.deepEqual(result.differences.legacyOnlySubjects, ["chemistry"]);
});

test("legacy all-access scopes always require explicit review", () => {
  const result = compareTeacherScopeParity(
    { isAll: true },
    { classes: [], subjects: [], students: [] },
  );
  assert.equal(result.status, "legacy_all_requires_review");
});
