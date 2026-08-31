import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { idempotencyPayloadHash } from "../lib/application/idempotency-key.ts";
import { canAccessResource } from "../lib/application/resource-access.ts";

test("resource policy covers admin, assigned teacher, unassigned teacher, owner student, and unrelated student", () => {
  const resource = { ownerId: "student-owner", assignedActorIds: ["teacher-assigned"] };
  assert.equal(canAccessResource({ id: "admin-1", role: "admin" }, resource), true);
  assert.equal(canAccessResource({ id: "teacher-assigned", role: "teacher" }, resource), true);
  assert.equal(canAccessResource({ id: "teacher-other", role: "teacher" }, resource), false);
  assert.equal(canAccessResource({ id: "student-owner", role: "student" }, resource), true);
  assert.equal(canAccessResource({ id: "student-other", role: "student" }, resource), false);
});

test("idempotency hashes are order stable, date aware, and payload sensitive", () => {
  assert.equal(idempotencyPayloadHash({ a: 1, b: 2 }), idempotencyPayloadHash({ b: 2, a: 1 }));
  assert.notEqual(idempotencyPayloadHash({ at: new Date("2026-01-01") }), idempotencyPayloadHash({ at: new Date("2026-01-02") }));
  assert.notEqual(idempotencyPayloadHash({ amount: 100 }), idempotencyPayloadHash({ amount: 101 }));
});

test("migrated route adapters contain no Mongoose query construction", () => {
  const routes = [
    ["app", "api", "enrollments", "route.ts"],
    ["app", "api", "written-exams", "route.ts"],
    ["app", "api", "student-reports", "route.ts"],
    ["app", "api", "student-reports", "pdf", "route.ts"],
    ["app", "api", "admin", "finance", "route.ts"],
  ];
  const queryPattern = /\.(?:find|findOne|findById|exists|create|updateOne|findOneAndUpdate|bulkWrite|countDocuments|aggregate)\(/;
  for (const route of routes) {
    const source = readFileSync(join(process.cwd(), ...route), "utf8");
    assert.doesNotMatch(source, queryPattern, route.join("/"));
    assert.doesNotMatch(source, /@\/lib\/db\/models\//, route.join("/"));
  }
});

test("repositories include canonical scope in database filters", () => {
  for (const name of ["enrollment-repository.ts", "finance-repository.ts", "written-exam-repository.ts", "student-report-repository.ts"]) {
    const source = readFileSync(join(process.cwd(), "lib", "repositories", name), "utf8");
    assert.match(source, /canonicalScopeFilter/, name);
  }
});

test("high-risk mutations use the shared idempotency primitive", () => {
  for (const name of ["enrollment-service.ts", "finance-service.ts", "written-exam-service.ts", "student-report-application-service.ts"]) {
    const source = readFileSync(join(process.cwd(), "lib", "application", name), "utf8");
    assert.match(source, /runIdempotentMutation/, name);
  }
});
