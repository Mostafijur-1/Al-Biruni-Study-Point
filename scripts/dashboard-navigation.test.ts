import assert from "node:assert/strict";
import test from "node:test";

import {
  dashboardTopLevelRoutes,
  isStudentToolRoute,
  isTopLevelDashboardRoute,
} from "../lib/dashboard-navigation.ts";

test("student navigation has at most six top-level task destinations", () => {
  assert.equal(dashboardTopLevelRoutes.student.length, 6);
  assert.equal(new Set(dashboardTopLevelRoutes.student).size, 6);
});

test("optional engagement features live behind the tools hub", () => {
  assert.equal(isTopLevelDashboardRoute("student", "/student/tools"), true);
  assert.equal(isTopLevelDashboardRoute("student", "/student/game"), false);
  assert.equal(isTopLevelDashboardRoute("student", "/student/challenge"), false);
  assert.equal(isStudentToolRoute("/student/challenge"), true);
  assert.equal(isStudentToolRoute("/student/labs/physics"), true);
});

test("teacher navigation exposes the actionable class workflow", () => {
  assert.equal(isTopLevelDashboardRoute("teacher", "/teacher"), true);
  assert.equal(isTopLevelDashboardRoute("teacher", "/teacher/classes"), true);
  assert.equal(isTopLevelDashboardRoute("teacher", "/teacher/results"), true);
  assert.equal(dashboardTopLevelRoutes.teacher.length, 6);
});

test("admin navigation exposes academic operations without exceeding six destinations", () => {
  assert.equal(isTopLevelDashboardRoute("admin", "/admin/academic"), true);
  assert.equal(dashboardTopLevelRoutes.admin.length, 6);
});
