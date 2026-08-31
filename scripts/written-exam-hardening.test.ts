import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { replayWrittenResultCorrections } from "../lib/written-exam/correction-history.ts";
import { writtenExamMutationSchema } from "../lib/validations/written-exam.schema.ts";

const examId = "507f1f77bcf86cd799439011";

test("optional written question references only accept Google Drive", () => {
  assert.equal(writtenExamMutationSchema.safeParse({ action: "set-question-link", examId, url: null }).success, true);
  assert.equal(writtenExamMutationSchema.safeParse({ action: "set-question-link", examId, url: "https://drive.google.com/file/d/example/view" }).success, true);
  assert.equal(writtenExamMutationSchema.safeParse({ action: "set-question-link", examId, url: "https://docs.google.com/document/d/example/edit" }).success, true);
  assert.equal(writtenExamMutationSchema.safeParse({ action: "set-question-link", examId, url: "https://example.com/question.pdf" }).success, false);
});

test("written correction replay reproduces current state and rejects broken history", () => {
  const history = [
    { sequence: 1, before: { marks: 70, comment: "Original" }, after: { marks: 75, comment: "Recount" } },
    { sequence: 2, before: { marks: 75, comment: "Recount" }, after: { marks: 78, comment: "Verified" } },
  ];
  assert.deepEqual(replayWrittenResultCorrections({ marks: 70, comment: "Original" }, history), { current: { marks: 78, comment: "Verified" }, correctionSequence: 2 });
  assert.throws(() => replayWrittenResultCorrections({ marks: 70 }, [{ sequence: 2, before: { marks: 70 }, after: { marks: 75 } }]), /inconsistent/);
  assert.throws(() => replayWrittenResultCorrections({ marks: 70 }, [{ sequence: 1, before: { marks: 69 }, after: { marks: 75 } }]), /inconsistent/);
});

test("written question access is authorized before link or legacy bytes are returned", async () => {
  const source = await readFile(new URL("../lib/application/written-exam-service.ts", import.meta.url), "utf8");
  const questionStart = source.indexOf("if (input.examId && input.question)");
  const accessCheck = source.indexOf("assertExamAccess(context, input.examId, true)", questionStart);
  const sourceReturn = source.indexOf("external-link", questionStart);
  assert.ok(questionStart >= 0 && accessCheck > questionStart && sourceReturn > accessCheck);
  const uploadBranch = source.slice(source.indexOf("export async function uploadWrittenExamQuestion"), source.indexOf("export async function mutateWrittenExam"));
  assert.match(uploadBranch, /assertExamAccess/);
  assert.match(uploadBranch, /uploads are disabled/);
});
