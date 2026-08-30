import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ObjectId } from "mongodb";

import { normalizeAcademicAlias, subjectAcceptsLegacyAlias } from "../lib/academic-alias.ts";
import { selectTeacherAuthorityDecision } from "../lib/auth/canonical-authority-decision.ts";
import { missingCanonicalPaths } from "../lib/db/canonical-scope-guard.ts";
import { buildUniqueAliasLookup } from "../lib/db/canonical-scope-backfill.ts";

test("academic aliases normalize only at the compatibility boundary", () => {
  assert.equal(normalizeAcademicAlias("  Higher   Math "), "higher math");
  assert.equal(subjectAcceptsLegacyAlias({
    code: "PHY",
    name: "Physics",
    nameBn: "পদার্থবিজ্ঞান",
    aliases: ["পদার্থ বিজ্ঞান"],
  }, " physics "), true);
  assert.equal(subjectAcceptsLegacyAlias({ code: "PHY", name: "Physics", nameBn: "পদার্থবিজ্ঞান" }, "Chemistry"), false);
});

test("backfill resolves only unique aliases", () => {
  const organizationId = new ObjectId();
  const physics = { _id: new ObjectId(), organizationId, code: "PHY", name: "Physics", nameBn: "পদার্থ" };
  const chemistry = { _id: new ObjectId(), organizationId, code: "CHEM", name: "Chemistry", nameBn: "রসায়ন", aliases: ["science"] };
  const generalScience = { _id: new ObjectId(), organizationId, code: "SCI", name: "Science", nameBn: "বিজ্ঞান", aliases: ["science"] };
  const lookup = buildUniqueAliasLookup([physics, chemistry, generalScience]);
  assert.equal(String(lookup("physics")?._id), String(physics._id));
  assert.equal(lookup("science"), undefined);
  assert.equal(lookup("unknown"), undefined);
});

test("canonical authority never falls back to a broader legacy decision", () => {
  assert.deepEqual(selectTeacherAuthorityDecision({
    legacyAllowed: true,
    canonicalAllowed: false,
    canonicalAuthorityEnabled: true,
  }), { allowed: false, authority: "canonical", shadowMismatch: true });
  assert.deepEqual(selectTeacherAuthorityDecision({
    legacyAllowed: false,
    canonicalAllowed: true,
    canonicalAuthorityEnabled: false,
  }), { allowed: false, authority: "legacy", shadowMismatch: true });
});

test("canonical scope guard reports absent values", () => {
  assert.deepEqual(missingCanonicalPaths({ organizationId: "org", subjectId: "" }, ["organizationId", "subjectId"]), ["subjectId"]);
});

test("operational and legacy schemas expose canonical scope", () => {
  for (const name of ["Course", "Video", "CqAssignment", "PracticeQuestion", "McqExam"]) {
    const source = readFileSync(join(process.cwd(), "lib", "db", "models", `${name}.ts`), "utf8");
    assert.match(source, /organizationId/);
    assert.match(source, /subjectId/);
    assert.match(source, /requireCanonicalPathsWhenEnabled/);
  }
  for (const name of ["WrittenExam", "StudentReportComment"]) {
    const source = readFileSync(join(process.cwd(), "lib", "db", "models", `${name}.ts`), "utf8");
    for (const path of ["organizationId", "branchId", "academicSessionId", "batchId"]) {
      assert.match(source, new RegExp(path));
    }
  }
});

test("learning write routes propagate canonical scope", () => {
  for (const path of [
    ["app", "api", "courses", "route.ts"],
    ["app", "api", "videos", "route.ts"],
    ["app", "api", "cq", "assignments", "route.ts"],
    ["app", "api", "teacher", "exams", "route.ts"],
    ["app", "api", "teacher", "mcqs", "upload", "route.ts"],
    ["app", "api", "admin", "practice-mcqs", "upload", "route.ts"],
  ]) {
    const source = readFileSync(join(process.cwd(), ...path), "utf8");
    assert.match(source, /canonicalScope/);
    assert.match(source, /subjectId/);
    assert.match(source, /organizationId/);
  }
  const questionRoute = readFileSync(join(process.cwd(), "app", "api", "teacher", "exams", "[id]", "questions", "route.ts"), "utf8");
  assert.match(questionRoute, /subjectId: exam\.subjectId/);
  assert.match(questionRoute, /isCanonicalAcademicAuthorityEnabled/);
});

test("Step 3 migration is bounded, dry-run first, and confirmation guarded", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "migrate-step3-canonical-scope.ts"), "utf8");
  assert.match(source, /--limit=/);
  assert.match(source, /limit > 5_000/);
  assert.match(source, /if \(apply && confirmation !== STEP3_SCOPE_MIGRATION_ID\)/);
  assert.match(source, /mode: apply \? "apply" : "dry-run"/);
});

test("authorization evidence is commit-bound and redacts teacher identifiers", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "audit-phase2-teacher-scope.ts"), "utf8");
  assert.match(source, /Evidence mode requires --commit=<deployed-git-sha>/);
  assert.match(source, /teacherRef: anonymousTeacherRef/);
  assert.doesNotMatch(source, /teacherId: String\(teacher\._id\)/);
});
