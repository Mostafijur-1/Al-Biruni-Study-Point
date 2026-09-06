import { createHash } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";

export const HISTORICAL_PRACTICE_ATTEMPT_ID = "20260906_historical_practice_attempts_v1";

const stableId = (id: unknown) => new ObjectId(createHash("sha256").update(`practice-result:${String(id)}`).digest("hex").slice(0, 24));
const ref = (id: unknown) => createHash("sha256").update(`practice-result:${String(id)}`).digest("hex").slice(0, 16);

export async function inspectHistoricalPracticeAttemptBackfill(db: Db, limit = 500) {
  const count = await db.collection("practiceresults").countDocuments({ authoritativeAttempt: { $exists: false } });
  if (count > limit) throw new Error(`Historical practice results exceed the reviewed ${limit}-document bound.`);
  const results = await db.collection("practiceresults").find({ authoritativeAttempt: { $exists: false } }).limit(limit).toArray();
  const studentIds = results.map((row) => row.student).filter(Boolean);
  const students = new Set((await db.collection("users").find({ _id: { $in: studentIds } }, { projection: { _id: 1 } }).toArray()).map((row) => String(row._id)));
  const exceptions: Array<{ ref: string; reason: string }> = [];
  const plans: Array<{ result: Document; attemptId: ObjectId }> = [];
  for (const result of results) {
    if (!result.student || !students.has(String(result.student))) {
      exceptions.push({ ref: ref(result._id), reason: "student_missing" });
    } else if (!String(result.subject ?? "").trim() || !Number.isFinite(result.totalQuestions) || result.totalQuestions < 1 || !Number.isFinite(result.score) || result.score < 0 || result.score > result.totalQuestions || !Number.isFinite(result.timeTaken) || result.timeTaken < 0) {
      exceptions.push({ ref: ref(result._id), reason: "invalid_historical_result" });
    } else {
      plans.push({ result, attemptId: stableId(result._id) });
    }
  }
  return { plans, report: { eligibleResults: results.length, plannedAttempts: plans.length, exceptionCount: exceptions.length, exceptions } };
}

export async function applyHistoricalPracticeAttemptBackfill(db: Db, limit = 500) {
  const inspected = await inspectHistoricalPracticeAttemptBackfill(db, limit);
  if (inspected.report.exceptionCount) throw new Error("Historical practice attempt backfill has unresolved exceptions.");
  if (!inspected.plans.length) return { ...inspected.report, insertedAttempts: 0, linkedResults: 0 };
  const attempts = db.collection("practiceattempts");
  const now = new Date();
  const inserted = await attempts.bulkWrite(inspected.plans.map(({ result, attemptId }) => ({ updateOne: {
    filter: { _id: attemptId },
    update: { $setOnInsert: {
      _id: attemptId, student: result.student, subject: String(result.subject).trim(), answers: [],
      assessmentSnapshot: { subject: String(result.subject).trim(), totalQuestions: result.totalQuestions, passMarkPercent: result.passMarkPercent ?? 60, mode: result.isTeacherSet ? "teacher" : "general" },
      totalQuestions: result.totalQuestions, score: result.score, percentage: result.percentage,
      isPassed: result.isPassed, timeTaken: result.timeTaken, teacherComment: result.teacherComment ?? "",
      commentedBy: result.commentedBy, isTeacherSet: result.isTeacherSet ?? false, teacherId: result.teacherId,
      isCancelled: result.isCancelled ?? false, voidedAt: result.voidedAt, voidedBy: result.voidedBy,
      voidReason: result.voidReason, passMarkPercent: result.passMarkPercent,
      submittedAt: result.submittedAt ?? result.createdAt ?? now,
      legacySource: { collection: "PracticeResult", id: String(result._id) },
      createdAt: result.createdAt ?? now, updatedAt: now,
    } }, upsert: true,
  } })), { ordered: false });
  const linked = await db.collection("practiceresults").bulkWrite(inspected.plans.map(({ result, attemptId }) => ({ updateOne: {
    filter: { _id: result._id, authoritativeAttempt: { $exists: false } },
    update: { $set: { authoritativeAttempt: attemptId, projectionVersion: 1, updatedAt: now } },
  } })), { ordered: false });
  return { ...inspected.report, insertedAttempts: inserted.upsertedCount, linkedResults: linked.modifiedCount };
}
