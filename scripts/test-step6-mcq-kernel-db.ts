import assert from "node:assert/strict";
import mongoose from "mongoose";

import { applyAssessmentReferenceBackfill, inspectAssessmentReferenceBackfill } from "../lib/db/assessment-reference-backfill.ts";
import { AssessmentAttempt } from "../lib/db/models/AssessmentAttempt.ts";
import { AttemptSession } from "../lib/db/models/AttemptSession.ts";
import { PracticeAttempt } from "../lib/db/models/PracticeAttempt.ts";
import { PracticeQuestion } from "../lib/db/models/PracticeQuestion.ts";
import { PracticeResult } from "../lib/db/models/PracticeResult.ts";
import { recordAuthoritativeAssessmentAttempt } from "../lib/mcq/assessment-attempt-adapter.ts";
import { materializeLegacyMcqAssessment, practiceSelectionSourceId } from "../lib/mcq/assessment-kernel-adapter.ts";
import { rebuildPracticeResult, reconcilePracticeResultProjections } from "../lib/mcq/practice-result-projection.ts";
import { saveAttemptDraft } from "../lib/mcq/attempt-session.ts";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is required.");
await mongoose.connect(uri, { dbName: "absp", autoIndex: true });
try {
  const organizationId = new mongoose.Types.ObjectId();
  const subjectId = new mongoose.Types.ObjectId();
  const chapterId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const legacyQuestion = await PracticeQuestion.create({ organizationId, subjectId, chapterId, level: "ssc", subject: "Physics", chapter: "Motion", question: "2 + 2?", options: ["3", "4", "5", "6"], correctIndex: 1, explanation: "Four", createdBy: ownerId });
  const materializeInput = {
    source: { collection: "PracticeSelection" as const, id: practiceSelectionSourceId({ questionIds: [String(legacyQuestion._id)], durationSeconds: 60, passMarkPercent: 60 }) },
    organizationId: String(organizationId), subjectId: String(subjectId), title: "Physics Practice", kind: "practice" as const,
    durationSeconds: 60, passRule: { mode: "percent" as const, threshold: 60 }, ownerId: String(ownerId), ownerRole: "admin" as const,
    questions: [{ id: String(legacyQuestion._id), organizationId: String(organizationId), subjectId: String(subjectId), chapterId: String(chapterId), prompt: legacyQuestion.question, options: legacyQuestion.options, correctIndex: 1, explanation: "Four", marks: 1, ownerId: String(ownerId), ownerRole: "admin" as const, collection: "PracticeQuestion" as const }],
  };
  const first = await materializeLegacyMcqAssessment(materializeInput);
  const second = await materializeLegacyMcqAssessment(materializeInput);
  assert.ok(first && second);
  assert.equal(String(first.assessmentVersionId), String(second.assessmentVersionId));

  const session = await AttemptSession.create({ student: studentId, kind: "practice", subject: "Physics", questionIds: [legacyQuestion._id], durationSeconds: 60, status: "started", startedAt: new Date(), organizationId, assessmentId: first.assessmentId, assessmentVersionId: first.assessmentVersionId, questionVersionIds: first.questionVersionIds });
  const savedDraft = await saveAttemptDraft({ sessionId: String(session._id), studentId: String(studentId), kind: "practice", expectedRevision: 0, responses: [{ questionId: String(legacyQuestion._id), selectedIndex: 1 }] });
  assert.equal(savedDraft.ok, true);
  assert.equal((await saveAttemptDraft({ sessionId: String(session._id), studentId: String(studentId), kind: "practice", expectedRevision: 0, responses: [] })).reason, "conflict");
  const attemptInput = { attemptSessionId: String(session._id), studentId: String(studentId), responses: [{ questionId: String(legacyQuestion._id), selectedIndex: 1, awardedMarks: 1, isCorrect: true }], score: 1, totalMarks: 1, percentage: 100, passed: true, submittedAt: new Date() };
  const canonicalAttempt = await recordAuthoritativeAssessmentAttempt(attemptInput);
  const retry = await recordAuthoritativeAssessmentAttempt(attemptInput);
  assert.ok(canonicalAttempt && retry);
  assert.equal(String(canonicalAttempt._id), String(retry._id));
  assert.equal(await AssessmentAttempt.countDocuments(), 1);

  const practiceAttempt = await PracticeAttempt.create({ attemptSession: session._id, assessmentAttemptId: canonicalAttempt._id, student: studentId, subject: "Physics", answers: [{ questionId: legacyQuestion._id, question: legacyQuestion.question, options: legacyQuestion.options, selectedIndex: 1, isCorrect: true, correctIndex: 1, explanation: "Four" }], totalQuestions: 1, score: 1, percentage: 100, isPassed: true, timeTaken: 20, passMarkPercent: 60, submittedAt: attemptInput.submittedAt });
  const projection = await rebuildPracticeResult(practiceAttempt);
  assert.equal(String(projection.authoritativeAttempt), String(practiceAttempt._id));
  await PracticeResult.updateOne({ _id: projection._id }, { $set: { score: 0 } });
  assert.deepEqual(await reconcilePracticeResultProjections(), { inspected: 1, repaired: 1 });
  assert.equal((await PracticeResult.findById(projection._id).lean())?.score, 1);

  const db = mongoose.connection.db;
  if (!db) throw new Error("Missing database handle.");
  const inspected = await inspectAssessmentReferenceBackfill(db, 100);
  assert.ok(inspected.report.plannedTotal >= 3);
  await applyAssessmentReferenceBackfill(db, 100);
  const refreshedQuestion = await PracticeQuestion.findById(legacyQuestion._id).lean();
  assert.equal(String(refreshedQuestion?.questionVersionId), String(first.questionVersionIds[0]));
  assert.equal((await PracticeResult.findById(projection._id).lean())?.projectionVersion, 1);

  console.log(JSON.stringify({ status: "passed", scenarios: ["materialization-idempotency", "submit-idempotency", "projection-rebuild", "reference-backfill"] }, null, 2));
} finally {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
