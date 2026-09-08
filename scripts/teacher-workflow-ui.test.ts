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

test("batch-wide teacher assignments allow comments and student reports", async () => {
  const [policy, reports] = await Promise.all([
    readFile("lib/auth/teacher-domain-policy.ts", "utf8"),
    readFile("lib/student-report-service.ts", "utf8"),
  ]);

  assert.match(policy, /"studentIds\.0": \{ \$exists: false \}/);
  assert.match(reports, /!row\.studentIds\?\.length \|\| row\.studentIds\.includes\(studentId\)/);
  assert.match(reports, /batchId: \{ \$in: allowedBatchIds \}/);
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
