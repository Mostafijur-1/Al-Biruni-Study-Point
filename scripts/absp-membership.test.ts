import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { adminUpdateUserSchema } from "../lib/validations/admin.schema.ts";

test("admin can explicitly include or exclude an ABSP member", () => {
  assert.equal(adminUpdateUserSchema.parse({ isAbspMember: true }).isAbspMember, true);
  assert.equal(adminUpdateUserSchema.parse({ isAbspMember: false }).isAbspMember, false);
});

test("ABSP membership remains an explicit admin mutation", () => {
  assert.equal(adminUpdateUserSchema.safeParse({}).success, false);
});

test("general students do not receive or render the ABSP routine", () => {
  const sessionSource = readFileSync(join(process.cwd(), "lib", "auth", "session.ts"), "utf8");
  const routineRoute = readFileSync(join(process.cwd(), "app", "api", "routines", "route.ts"), "utf8");
  const dashboard = readFileSync(join(process.cwd(), "components", "student", "StudentHomeDashboard.tsx"), "utf8");

  assert.match(sessionSource, /isAbspMember teacherUsage/);
  assert.match(routineRoute, /actor\.role === "student" && !actor\.isAbspMember/);
  assert.match(dashboard, /user\?\.isAbspMember && <RoutineDashboard/);
});

test("learning resources expose only mistake recovery and science lab", () => {
  const toolsPage = readFileSync(join(process.cwd(), "app", "(dashboard)", "student", "tools", "page.tsx"), "utf8");
  const resourceLinks = [...toolsPage.matchAll(/href: "(\/student\/[^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(resourceLinks, ["/student/mistakes", "/student/labs"]);
});
