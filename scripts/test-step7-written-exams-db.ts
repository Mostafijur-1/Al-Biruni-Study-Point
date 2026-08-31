import assert from "node:assert/strict";
import mongoose from "mongoose";
import { NextRequest } from "next/server.js";

import type { RequestContext } from "../lib/application/request-context.ts";
import { AuditLog } from "../lib/db/models/AuditLog.ts";
import { AssessmentAttempt } from "../lib/db/models/AssessmentAttempt.ts";
import { WrittenExam } from "../lib/db/models/WrittenExam.ts";
import { WrittenExamResult } from "../lib/db/models/WrittenExamResult.ts";
import { WrittenExamResultCorrection } from "../lib/db/models/WrittenExamResultCorrection.ts";
import { WrittenExamResultPublication } from "../lib/db/models/WrittenExamResultPublication.ts";
import { applyWrittenExamBackfill, inspectWrittenExamBackfill } from "../lib/db/written-exam-backfill.ts";
import { materializeWrittenExamAssessment } from "../lib/written-exam/assessment-adapter.ts";
import { replayWrittenResultCorrections } from "../lib/written-exam/correction-history.ts";
import { appendWrittenResultCorrection, publishWrittenResultsAtomically } from "../lib/written-exam/publication-service.ts";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is required.");
await mongoose.connect(uri, { dbName: "absp", autoIndex: true });
try {
  const organizationId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const academicSessionId = new mongoose.Types.ObjectId();
  const batchId = new mongoose.Types.ObjectId();
  const subjectId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const context: RequestContext = { actor: { id: String(ownerId), name: "Admin", role: "admin" }, request: new NextRequest("http://localhost/api/written-exams", { headers: { "x-request-id": "step7-test" } }), requestId: "step7-test", scope: { organizationId: String(organizationId), branchId: String(branchId), academicSessionId: String(academicSessionId) } };
  const exam = await WrittenExam.create({ organizationId, branchId, academicSessionId, batchId, subjectId, title: "Written Physics", examDate: new Date(), totalMarks: 100, questionLink: { provider: "google-drive", url: "https://drive.google.com/file/d/example/view", setBy: ownerId, setAt: new Date() }, createdBy: ownerId, creatorRole: "admin" });
  const result = await WrittenExamResult.create({ examId: exam._id, studentId, enrollmentId, marks: 70, comment: "Original", enteredBy: ownerId });
  const input = { examId: String(exam._id), organizationId: String(organizationId), branchId: String(branchId), academicSessionId: String(academicSessionId), batchId: String(batchId), subjectId: String(subjectId), title: exam.title, totalMarks: exam.totalMarks, ownerId: String(ownerId), ownerRole: "admin" as const, questionLink: exam.questionLink?.url };
  const kernel = await materializeWrittenExamAssessment(input);
  const kernelRetry = await materializeWrittenExamAssessment(input);
  assert.equal(String(kernel.assessmentVersionId), String(kernelRetry.assessmentVersionId));

  const first = await publishWrittenResultsAtomically(context, { examId: String(exam._id), ...kernel });
  const retry = await publishWrittenResultsAtomically(context, { examId: String(exam._id), ...kernel });
  assert.equal(first.alreadyPublished, false);
  assert.equal(retry.alreadyPublished, true);
  assert.equal(String(first.publicationId), String(retry.publicationId));
  assert.equal(await WrittenExamResultPublication.countDocuments({ examId: exam._id }), 1);
  assert.equal(await AssessmentAttempt.countDocuments({ "legacySource.collection": "WrittenExamResult", "legacySource.id": String(result._id) }), 1);
  await assert.rejects(WrittenExamResult.updateOne({ _id: result._id }, { $set: { marks: 1 } }), /immutable/);
  await assert.rejects(WrittenExamResultPublication.updateOne({ _id: first.publicationId }, { $set: { resultCount: 99 } }), /immutable/);

  const correction1 = await appendWrittenResultCorrection(context, { examId: String(exam._id), studentId: String(studentId), marks: 75, comment: "Recount", reason: "Paper was recounted" });
  const correction2 = await appendWrittenResultCorrection(context, { examId: String(exam._id), studentId: String(studentId), marks: 78, comment: "Verified", reason: "Section total corrected" });
  assert.equal(correction1.sequence, 1);
  assert.equal(correction2.sequence, 2);
  const stored = await WrittenExamResult.findById(result._id).lean();
  const history = await WrittenExamResultCorrection.find({ resultId: result._id }).sort({ sequence: 1 }).lean();
  assert.ok(stored);
  const current = replayWrittenResultCorrections({ marks: stored.marks, comment: stored.comment }, history);
  assert.equal(current.current.marks, 78);
  assert.equal(current.current.comment, "Verified");
  await assert.rejects(WrittenExamResultCorrection.updateOne({ _id: correction1._id }, { $set: { "after.marks": 80 } }), /append-only/);
  assert.equal(await AuditLog.countDocuments({ action: { $in: ["written-exam.published", "written-result.corrected"] } }), 3);

  const legacyExamId = new mongoose.Types.ObjectId();
  const legacyResultId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection("writtenexams").insertOne({ _id: legacyExamId, organizationId, branchId, academicSessionId, batchId, subjectId, title: "Legacy", examDate: new Date(), totalMarks: 50, createdBy: ownerId, creatorRole: "admin", isPublished: true, publishedAt: new Date(), publishedBy: ownerId, createdAt: new Date(), updatedAt: new Date() });
  await mongoose.connection.collection("writtenexamresults").insertOne({ _id: legacyResultId, examId: legacyExamId, studentId, enrollmentId, marks: 40, enteredBy: ownerId, createdAt: new Date(), updatedAt: new Date() });
  const db = mongoose.connection.db;
  if (!db) throw new Error("Missing database handle.");
  const inspected = await inspectWrittenExamBackfill(db, 100);
  assert.equal(inspected.report.plannedPublications, 1);
  await applyWrittenExamBackfill(db, 100);
  assert.ok((await db.collection("writtenexamresults").findOne({ _id: legacyResultId }))?.publicationId);
  assert.equal(await db.collection("writtenexamresultpublications").countDocuments({ examId: legacyExamId }), 1);

  console.log(JSON.stringify({ status: "passed", scenarios: ["kernel-idempotency", "atomic-publication", "published-result-immutability", "append-only-corrections", "legacy-backfill"] }, null, 2));
} finally {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
