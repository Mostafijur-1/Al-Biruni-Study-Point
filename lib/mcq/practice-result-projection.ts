import type { Types } from "mongoose";

import { PracticeAttempt, type IPracticeAttempt } from "../db/models/PracticeAttempt.ts";
import { PracticeResult } from "../db/models/PracticeResult.ts";

export const PRACTICE_RESULT_PROJECTION_VERSION = 1;

type PracticeAttemptProjectionSource = Pick<IPracticeAttempt,
  "_id" | "attemptSession" | "student" | "subject" | "score" | "totalQuestions" | "percentage" | "isPassed" | "timeTaken" |
  "teacherComment" | "commentedBy" | "isTeacherSet" | "teacherId" | "isCancelled" | "voidedAt" | "voidedBy" | "voidReason" |
  "passMarkPercent" | "submittedAt" | "createdAt"
>;

export function projectPracticeResult(attempt: PracticeAttemptProjectionSource) {
  return {
    authoritativeAttempt: attempt._id,
    attemptSession: attempt.attemptSession,
    student: attempt.student,
    subject: attempt.subject,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    isPassed: attempt.isPassed,
    timeTaken: attempt.timeTaken,
    teacherComment: attempt.teacherComment ?? "",
    commentedBy: attempt.commentedBy,
    submittedAt: attempt.submittedAt ?? attempt.createdAt,
    isTeacherSet: attempt.isTeacherSet ?? false,
    teacherId: attempt.teacherId,
    isCancelled: attempt.isCancelled ?? false,
    voidedAt: attempt.voidedAt,
    voidedBy: attempt.voidedBy,
    voidReason: attempt.voidReason,
    passMarkPercent: attempt.passMarkPercent,
    projectionVersion: PRACTICE_RESULT_PROJECTION_VERSION,
  };
}

export async function rebuildPracticeResult(attempt: PracticeAttemptProjectionSource) {
  const projection = projectPracticeResult(attempt);
  const filter = attempt.attemptSession ? { attemptSession: attempt.attemptSession } : { authoritativeAttempt: attempt._id };
  return PracticeResult.findOneAndUpdate(filter, { $set: projection }, { new: true, upsert: true, setDefaultsOnInsert: true });
}

export async function reconcilePracticeResultProjections(filter: { attemptIds?: Types.ObjectId[]; limit?: number } = {}) {
  const query = filter.attemptIds ? { _id: { $in: filter.attemptIds } } : {};
  const attempts = await PracticeAttempt.find(query).sort({ _id: 1 }).limit(filter.limit ?? 0).lean();
  let repaired = 0;
  for (const attempt of attempts) {
    const expected = projectPracticeResult(attempt as unknown as PracticeAttemptProjectionSource);
    const existing = await PracticeResult.findOne(attempt.attemptSession ? { attemptSession: attempt.attemptSession } : { authoritativeAttempt: attempt._id }).lean();
    const differs = !existing || existing.score !== expected.score || existing.totalQuestions !== expected.totalQuestions || existing.percentage !== expected.percentage || existing.isPassed !== expected.isPassed || existing.isCancelled !== expected.isCancelled || existing.teacherComment !== expected.teacherComment || existing.projectionVersion !== PRACTICE_RESULT_PROJECTION_VERSION;
    if (differs) {
      await rebuildPracticeResult(attempt as unknown as PracticeAttemptProjectionSource);
      repaired += 1;
    }
  }
  return { inspected: attempts.length, repaired };
}
