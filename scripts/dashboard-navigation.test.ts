import assert from "node:assert/strict";
import test from "node:test";

import {
  dashboardTopLevelRoutes,
  isTopLevelDashboardRoute,
} from "../lib/dashboard-navigation.ts";

test("student navigation includes the schedule-first dashboard", () => {
  assert.deepEqual(dashboardTopLevelRoutes.student, [
    "/student",
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

test("admin navigation separates each administrative responsibility", () => {
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/academic"), true);
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/practice-mcqs"), true);
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/settings"), true);
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/attendance"), true);
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/routine"), true);
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/finance"), true);
  assert.equal(dashboardTopLevelRoutes.admin.length, 10);
});
