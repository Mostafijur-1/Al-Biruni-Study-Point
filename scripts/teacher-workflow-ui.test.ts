import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("teacher result screens expose comments without result cancellation controls", async () => {
  const [practiceResults, examResults] = await Promise.all([
    readFile("components/teacher/TeacherResultsDashboard.tsx", "utf8"),
    readFile("components/exam/TeacherMcqResults.tsx", "utf8"),
  ]);

  for (const source of [practiceResults, examResults]) {
    assert.match(source, /isCancelled/);
    assert.match(source, /Cancelled/);
    assert.doesNotMatch(source, /Void result|Cancelled Result|\/void|handleDeleteResult|handleDeleteAttempt/);
  }
});

test("teacher comments accept batch-wide assignments and reports follow teacher domains", async () => {
  const [policy, reports] = await Promise.all([
    readFile("lib/auth/teacher-domain-policy.ts", "utf8"),
    readFile("lib/student-report-service.ts", "utf8"),
  ]);

  assert.match(policy, /"studentIds\.0": \{ \$exists: false \}/);
  assert.match(reports, /teacherReportDomain/);
  assert.match(reports, /domain\?\.isAll \? \{\} : \{ studentId:/);
  assert.match(reports, /domain\?\.students\.includes\(studentId\)/);
  assert.match(reports, /domain\.classes\.includes\(student\.studentClass\)/);
});

test("written exams load all eligible current batches from their workspace API", async () => {
  const [workspace, service, repository] = await Promise.all([
    readFile("components/exam/WrittenExamWorkspace.tsx", "utf8"),
    readFile("lib/application/written-exam-service.ts", "utf8"),
    readFile("lib/repositories/written-exam-repository.ts", "utf8"),
  ]);

  assert.match(workspace, /apiFetch<\{ exams: Exam\[\]; batches: Batch\[\] \}>\("\/api\/written-exams"\)/);
  assert.doesNotMatch(workspace, /\/api\/batches\?status=/);
  assert.match(service, /batches: availableBatches\.map/);
  assert.match(repository, /limit\(1_000\)/);
});

test("written exam creation and report comments submit their forms", async () => {
  const [writtenExam, studentReport] = await Promise.all([
    readFile("components/exam/WrittenExamWorkspace.tsx", "utf8"),
    readFile("components/reports/StudentReportWorkspace.tsx", "utf8"),
  ]);

  assert.match(writtenExam, /<form onSubmit=\{createExam\}/);
  assert.match(writtenExam, /<Button type="submit" className="w-full"/);
  assert.match(studentReport, /<form onSubmit=\{addComment\}/);
  assert.match(studentReport, /<Button type="submit" disabled=\{saving \|\| !comment\.trim\(\)\}/);
});

test("teacher write APIs expose only assigned subjects and accept a non-empty comment", async () => {
  const [coachingSubjects, studentReports] = await Promise.all([
    readFile("app/api/coaching-subjects/route.ts", "utf8"),
    readFile("app/api/student-reports/route.ts", "utf8"),
  ]);

  assert.match(coachingSubjects, /assignedSubjectIds/);
  assert.match(coachingSubjects, /rows\.filter\(\(row\) => assignedSubjectIds\.has/);
  assert.match(coachingSubjects, /subjects: visibleRows\.map/);
  assert.match(studentReports, /comment: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(1_000\)/);
});
