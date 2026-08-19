import assert from "node:assert/strict";
import test from "node:test";

import {
  dashboardTopLevelRoutes,
  isTopLevelDashboardRoute,
} from "../lib/dashboard-navigation.ts";

test("student navigation restores the focused four-item menu", () => {
  assert.deepEqual(dashboardTopLevelRoutes.student, [
    "/student/profile",
    "/student/practice",
    "/student/exams",
    "/student/results",
  ]);
  assert.equal(isTopLevelDashboardRoute("student", "/student/courses"), false);
  assert.equal(isTopLevelDashboardRoute("student", "/student/tools"), false);
  assert.equal(isTopLevelDashboardRoute("student", "/student/game"), false);
});

test("teacher navigation exposes class content without routine sessions", () => {
  assert.equal(isTopLevelDashboardRoute("teacher", "/teacher"), true);
  assert.equal(isTopLevelDashboardRoute("teacher", "/teacher/classes"), true);
  assert.equal(isTopLevelDashboardRoute("teacher", "/teacher/results"), true);
  assert.equal(dashboardTopLevelRoutes.teacher.length, 6);
});

test("admin navigation exposes academic operations without exceeding six destinations", () => {
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/academic"), false);
  assert.equal(dashboardTopLevelRoutes.admin.length, 5);
});
