import { Types } from "mongoose";

import {
  AttemptSession,
  type AttemptKind,
  type IAttemptSession,
} from "@/lib/db/models/AttemptSession";

const SUBMISSION_GRACE_SECONDS = 30;

type CreateAttemptSessionInput = {
  organizationId?: string;
  assessmentId?: string;
  assessmentVersionId?: string;
  questionVersionIds?: string[];
  studentId: string;
  kind: AttemptKind;
  questionIds: string[];
  durationSeconds: number;
  examId?: string;
  subject?: string;
};

export async function createAttemptSession(input: CreateAttemptSessionInput) {
  return AttemptSession.create({
    organizationId: input.organizationId,
    assessmentId: input.assessmentId,
    assessmentVersionId: input.assessmentVersionId,
    questionVersionIds: input.questionVersionIds?.map((id) => new Types.ObjectId(id)) ?? [],
    student: input.studentId,
    kind: input.kind,
    exam: input.examId,
    subject: input.subject,
    questionIds: input.questionIds.map((id) => new Types.ObjectId(id)),
    durationSeconds: input.durationSeconds,
    status: "ready",
  });
}

export async function beginAttemptSession(
  sessionId: string,
  studentId: string,
  kind: AttemptKind,
) {
  const now = new Date();
  const readySession = await AttemptSession.findOne({
    _id: sessionId,
    student: studentId,
    kind,
    status: "ready",
  });

  if (readySession) {
    readySession.status = "started";
    readySession.startedAt = now;
    readySession.expiresAt = new Date(now.getTime() + readySession.durationSeconds * 1000);
    await readySession.save();
    return readySession;
  }

  return AttemptSession.findOne({
    _id: sessionId,
    student: studentId,
    kind,
    status: "started",
  });
}

export function getRemainingSeconds(session: IAttemptSession, now = new Date()) {
  if (!session.startedAt || !session.expiresAt) {
    return session.durationSeconds;
  }

  return Math.max(
    0,
    Math.min(
      session.durationSeconds,
      Math.ceil((session.expiresAt.getTime() - now.getTime()) / 1000),
    ),
  );
}

export function getTrustedTimeTaken(session: IAttemptSession, now = new Date()) {
  if (!session.startedAt) return 0;
  return Math.max(
    0,
    Math.min(
      session.durationSeconds,
      Math.round((now.getTime() - session.startedAt.getTime()) / 1000),
    ),
  );
}

export async function loadSubmissionSession(input: {
  sessionId: string;
  studentId: string;
  kind: AttemptKind;
  submittedQuestionIds: string[];
  examId?: string;
  subject?: string;
}) {
  const session = await AttemptSession.findOne({
    _id: input.sessionId,
    student: input.studentId,
    kind: input.kind,
    status: "started",
  });

  if (!session) return { ok: false as const, reason: "invalid" as const };
  if (input.examId && String(session.exam) !== input.examId) {
    return { ok: false as const, reason: "scope" as const };
  }
  if (input.subject && session.subject !== input.subject) {
    return { ok: false as const, reason: "scope" as const };
  }

  const allowedIds = new Set(session.questionIds.map(String));
  const submittedIds = new Set(input.submittedQuestionIds);
  if (
    submittedIds.size !== allowedIds.size ||
    Array.from(submittedIds).some((id) => !allowedIds.has(id))
  ) {
    return { ok: false as const, reason: "questions" as const };
  }

  const now = new Date();
  if (
    session.expiresAt &&
    now.getTime() > session.expiresAt.getTime() + SUBMISSION_GRACE_SECONDS * 1000
  ) {
    session.status = "expired";
    await session.save();
    return { ok: false as const, reason: "expired" as const };
  }

  return {
    ok: true as const,
    session,
    timeTaken: getTrustedTimeTaken(session, now),
    submittedAt: now,
  };
}

export async function markAttemptSessionSubmitted(sessionId: string, submittedAt = new Date()) {
  await AttemptSession.updateOne(
    { _id: sessionId, status: "started" },
    { $set: { status: "submitted", submittedAt } },
  );
}
