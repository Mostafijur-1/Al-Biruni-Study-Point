import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("admin responsibilities have distinct navigation destinations", async () => {
  const navigation = await readFile("components/layout/DashboardMobileNav.tsx", "utf8");
  const settingsPage = await readFile("app/(dashboard)/admin/settings/page.tsx", "utf8");
  const attendancePage = await readFile("app/(dashboard)/admin/attendance/page.tsx", "utf8");
  const overviewPage = await readFile("app/(dashboard)/admin/page.tsx", "utf8");

  assert.match(navigation, /href: "\/admin\/practice-mcqs",\s+label: "Question Bank"/);
  assert.match(navigation, /href: "\/admin\/settings",\s+label: "Practice Settings"/);
  assert.match(navigation, /href: "\/admin\/attendance",\s+label: "Attendance"/);
  assert.match(settingsPage, /AdminPracticeSettings/);
  assert.match(attendancePage, /AdminAttendanceRegister/);
  assert.doesNotMatch(overviewPage, /AdminAttendanceRegister/);
});

test("practice settings expose only the three supported test rules", async () => {
  const settings = await readFile("components/admin/AdminPracticeSettings.tsx", "utf8");
  const questionBank = await readFile("components/admin/AdminPracticeManager.tsx", "utf8");

  assert.match(settings, /Questions per test/);
  assert.match(settings, /Seconds per question/);
  assert.match(settings, /Pass mark/);
  assert.doesNotMatch(questionBank, /PracticeTestSettings/);
  assert.match(questionBank, /Question Bank/);
});
