import { randomUUID } from "node:crypto";

import mongoose, { type ClientSession } from "mongoose";
import type { NextRequest } from "next/server";

import type { SessionUser } from "../types/index.ts";
import {
  calculateAttendanceSummary,
  canManageAttendance,
  createAttendancePayloadHash,
  createRosterHash,
  defaultAttendancePolicy,
  type AttendanceStatus,
} from "./attendance-rules.ts";
import { getDhakaRoutineOccurrence } from "./attendance-occurrence.ts";
import { ApiRouteError } from "./api-error.ts";
import { getRequestId, writeAuditLog } from "./audit/write-audit-log.ts";
import { AttendanceCorrection } from "./db/models/AttendanceCorrection.ts";
import { AttendanceIdempotency } from "./db/models/AttendanceIdempotency.ts";
import { AttendanceOutbox } from "./db/models/AttendanceOutbox.ts";
import { AttendanceRecord } from "./db/models/AttendanceRecord.ts";
import { AttendanceSheet, type IAttendanceSheet } from "./db/models/AttendanceSheet.ts";
import { BatchEnrollment } from "./db/models/BatchEnrollment.ts";
import { CoachingEnrollmentSubject } from "./db/models/CoachingEnrollmentSubject.ts";
import { ClassSession } from "./db/models/ClassSession.ts";
import { RoutineSlot } from "./db/models/RoutineSlot.ts";
import { TeacherAssignment } from "./db/models/TeacherAssignment.ts";
import { User } from "./db/models/User.ts";

type AuditContext = {
  request: NextRequest;
  actor: SessionUser;
  reason: string;
};

type AttendanceMarkInput = {
  enrollmentId: string;
  status: AttendanceStatus;
  minutesLate?: number;
  privateNote?: string;
};

type IdempotentContext = {
  key: string;
  workflow: string;
  targetId: string;
  payload: unknown;
};

const idempotencyRetentionMs = 30 * 24 * 60 * 60 * 1000;

async function runTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
  } finally {
    await session.endSession();
  }
  if (result === undefined) {
    throw new ApiRouteError("Attendance workflow did not complete.", 500, "INTERNAL_ERROR");
  }
  return result;
}

function assertAttendanceManager(
  actor: SessionUser,
  teacherId: unknown,
  message = "Attendance sheet was not found.",
) {
  if (!canManageAttendance(actor.role, actor.id, String(teacherId))) {
    throw new ApiRouteError(message, 404, "NOT_FOUND");
  }
}

async function loadEffectiveRoster(classSession: {
  batchId: string | mongoose.Types.ObjectId;
  subjectId: string | mongoose.Types.ObjectId;
  scheduledStart: Date;
}, session?: ClientSession) {
  const subjectQuery = CoachingEnrollmentSubject.find({
    batchId: classSession.batchId,
    subjectId: classSession.subjectId,
    effectiveFrom: { $lte: classSession.scheduledStart },
    $or: [
      { effectiveTo: { $exists: false } },
      { effectiveTo: null },
      { effectiveTo: { $gte: classSession.scheduledStart } },
    ],
  }).select("enrollmentId");
  if (session) subjectQuery.session(session);
  const eligibleEnrollmentIds = await subjectQuery.distinct("enrollmentId");
  const query = BatchEnrollment.find({
    _id: { $in: eligibleEnrollmentIds },
    batchId: classSession.batchId,
    effectiveFrom: { $lte: classSession.scheduledStart },
    $or: [
      { effectiveTo: { $exists: false } },
      { effectiveTo: null },
      { effectiveTo: { $gte: classSession.scheduledStart } },
    ],
  }).sort({ studentId: 1, effectiveFrom: 1 });
  if (session) query.session(session);
  return query.lean();
}

async function assertRosterUnchanged(sheet: IAttendanceSheet, session: ClientSession) {
  const classSession = await ClassSession.findById(sheet.classSessionId).session(session);
  if (!classSession || classSession.status === "cancelled") {
    throw new ApiRouteError(
      "Class session is no longer eligible for attendance.",
      409,
      "ATTENDANCE_NOT_ELIGIBLE",
    );
  }
  const roster = await loadEffectiveRoster(classSession, session);
  const currentHash = createRosterHash(
    roster.map((item) => ({
      enrollmentId: String(item._id),
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
    })),
  );
  if (currentHash !== sheet.rosterHash) {
    throw new ApiRouteError(
      "The class roster changed. Refresh attendance before continuing.",
      409,
      "ATTENDANCE_ROSTER_CHANGED",
      { expectedRosterVersion: sheet.rosterVersion },
    );
  }
  return classSession;
}

async function beginIdempotentWorkflow(
  input: IdempotentContext & { organizationId: mongoose.Types.ObjectId; actor: SessionUser },
  session: ClientSession,
) {
  const payloadHash = createAttendancePayloadHash(input.payload);
  const existing = await AttendanceIdempotency.findOne({
    organizationId: input.organizationId,
    actorId: input.actor.id,
    workflow: input.workflow,
    key: input.key,
  }).session(session);

  if (existing) {
    if (existing.payloadHash !== payloadHash || existing.targetId !== input.targetId) {
      throw new ApiRouteError(
        "The idempotency key was already used for a different request.",
        409,
        "IDEMPOTENCY_KEY_REUSED",
      );
    }
    return { record: existing, replay: existing.status === "completed" };
  }

  const [record] = await AttendanceIdempotency.create(
    [{
      organizationId: input.organizationId,
      actorId: input.actor.id,
      workflow: input.workflow,
      targetId: input.targetId,
      key: input.key,
      payloadHash,
      status: "started",
      expiresAt: new Date(Date.now() + idempotencyRetentionMs),
    }],
    { session },
  );
  return { record, replay: false };
}

export function getAttendanceIdempotencyKey(request: NextRequest) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 200) {
    throw new ApiRouteError(
      "A valid Idempotency-Key header is required.",
      400,
      "VALIDATION_ERROR",
    );
  }
  return key;
}

export async function openRoutineAttendanceSheet(
  input: AuditContext & { routineSlotId: string },
) {
  const routine = await RoutineSlot.findOne({
    _id: input.routineSlotId,
    status: "active",
  });
  if (!routine || !routine.batchId || !routine.subjectId) {
    throw new ApiRouteError(
      "Routine is not eligible for attendance.",
      409,
      "ATTENDANCE_NOT_ELIGIBLE",
    );
  }
  assertAttendanceManager(input.actor, routine.teacherId, "Routine was not found.");

  const occurrence = getDhakaRoutineOccurrence(routine);
  if (
    !occurrence ||
    routine.effectiveFrom > occurrence.scheduledEnd ||
    (routine.effectiveTo && routine.effectiveTo < occurrence.scheduledStart)
  ) {
    throw new ApiRouteError(
      "Attendance is available only on the routine's scheduled day.",
      409,
      "ATTENDANCE_NOT_ELIGIBLE",
    );
  }

  let classSession = await ClassSession.findOne({
    routineSlotId: routine._id,
    scheduledStart: occurrence.scheduledStart,
  });
  if (!classSession) {
    try {
      classSession = await ClassSession.create({
        organizationId: routine.organizationId ?? routine.batchId,
        branchId: routine.branchId ?? routine.batchId,
        academicSessionId: routine.academicSessionId ?? routine.batchId,
        batchId: routine.batchId,
        subjectId: routine.subjectId,
        teacherId: routine.teacherId,
        routineSlotId: routine._id,
        scheduledStart: occurrence.scheduledStart,
        scheduledEnd: occurrence.scheduledEnd,
        status: "scheduled",
        createdBy: input.actor.id,
      });
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
        throw error;
      }
      classSession = await ClassSession.findOne({
        routineSlotId: routine._id,
        scheduledStart: occurrence.scheduledStart,
      });
      if (!classSession) throw error;
    }
  }

  return openAttendanceSheet({
    request: input.request,
    actor: input.actor,
    reason: input.reason,
    classSessionId: String(classSession._id),
  });
}

export async function openAttendanceSheet(
  input: AuditContext & { classSessionId: string },
) {
  const existing = await AttendanceSheet.findOne({ classSessionId: input.classSessionId });
  if (existing) {
    assertAttendanceManager(input.actor, existing.teacherId);
    return { sheet: existing, created: false };
  }

  try {
    const sheet = await runTransaction(async (session) => {
      const classSession = await ClassSession.findById(input.classSessionId).session(session);
      if (!classSession || classSession.status === "cancelled") {
        throw new ApiRouteError(
          "Class session is not eligible for attendance.",
          409,
          "ATTENDANCE_NOT_ELIGIBLE",
        );
      }
      assertAttendanceManager(input.actor, classSession.teacherId);

      const assignment = await TeacherAssignment.findOne({
        batchId: classSession.batchId,
        subjectId: classSession.subjectId,
        teacherId: classSession.teacherId,
        effectiveFrom: { $lte: classSession.scheduledStart },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: classSession.scheduledStart } },
        ],
      }).session(session);
      if (!assignment) {
        const routine = classSession.routineSlotId
          ? await RoutineSlot.findOne({
              _id: classSession.routineSlotId,
              batchId: classSession.batchId,
              subjectId: classSession.subjectId,
              teacherId: classSession.teacherId,
              status: "active",
            }).session(session)
          : null;
        if (!routine) {
          throw new ApiRouteError(
            "No effective teacher assignment or routine exists for this class session.",
            409,
            "ATTENDANCE_NOT_ELIGIBLE",
          );
        }
      }

      const roster = await loadEffectiveRoster(classSession, session);
      if (roster.length === 0) {
        throw new ApiRouteError(
          "The class session has no effective enrollment roster.",
          409,
          "ATTENDANCE_NOT_ELIGIBLE",
        );
      }
      const students = await User.find({
        _id: { $in: roster.map((item) => item.studentId) },
        role: "student",
      })
        .select("name studentCode studentClass")
        .session(session)
        .lean();
      const studentById = new Map(students.map((student) => [String(student._id), student]));
      if (studentById.size !== roster.length) {
        throw new ApiRouteError(
          "The effective roster contains an unavailable student account.",
          409,
          "ATTENDANCE_ROSTER_CHANGED",
        );
      }

      const rosterHash = createRosterHash(
        roster.map((item) => ({
          enrollmentId: String(item._id),
          effectiveFrom: item.effectiveFrom,
          effectiveTo: item.effectiveTo,
        })),
      );
      const [createdSheet] = await AttendanceSheet.create(
        [{
          organizationId: classSession.organizationId,
          branchId: classSession.branchId,
          academicSessionId: classSession.academicSessionId,
          batchId: classSession.batchId,
          subjectId: classSession.subjectId,
          teacherId: classSession.teacherId,
          teacherAssignmentId: assignment?._id,
          classSessionId: classSession._id,
          routineSlotId: classSession.routineSlotId,
          rosterVersion: 1,
          rosterHash,
          rosterSnapshotAt: classSession.scheduledStart,
          policySnapshot: defaultAttendancePolicy,
          status: "draft",
          workflowVersion: 1,
          openedBy: input.actor.id,
          openedAt: new Date(),
        }],
        { session },
      );

      await AttendanceRecord.insertMany(
        roster.map((enrollment) => {
          const student = studentById.get(String(enrollment.studentId))!;
          return {
            organizationId: classSession.organizationId,
            branchId: classSession.branchId,
            sheetId: createdSheet._id,
            classSessionId: classSession._id,
            enrollmentId: enrollment._id,
            studentId: enrollment.studentId,
            studentNameSnapshot: student.name,
            studentCodeSnapshot: student.studentCode,
            studentClassSnapshot: student.studentClass,
            status: "unmarked",
            workflowVersion: 1,
            correctionVersion: 0,
          };
        }),
        { session },
      );

      await writeAuditLog({
        request: input.request,
        actor: input.actor,
        organizationId: classSession.organizationId,
        branchId: classSession.branchId,
        action: "attendance.sheet.opened",
        resourceType: "AttendanceSheet",
        resourceId: createdSheet._id,
        reason: input.reason,
        after: {
          classSessionId: String(classSession._id),
          rosterVersion: 1,
          rosterCount: roster.length,
          status: "draft",
        },
        session,
      });
      return createdSheet;
    });
    return { sheet, created: true };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      const concurrent = await AttendanceSheet.findOne({ classSessionId: input.classSessionId });
      if (concurrent) {
        assertAttendanceManager(input.actor, concurrent.teacherId);
        return { sheet: concurrent, created: false };
      }
    }
    throw error;
  }
}

export async function markAttendance(
  input: AuditContext & { sheetId: string; version: number; entries: AttendanceMarkInput[] },
) {
  return runTransaction(async (session) => {
    const sheet = await AttendanceSheet.findById(input.sheetId).session(session);
    if (!sheet) throw new ApiRouteError("Attendance sheet was not found.", 404);
    assertAttendanceManager(input.actor, sheet.teacherId);
    if (sheet.status !== "draft") {
      throw new ApiRouteError(
        "Submitted attendance cannot be edited directly.",
        409,
        "ATTENDANCE_ALREADY_SUBMITTED",
      );
    }
    if (sheet.workflowVersion !== input.version) {
      throw new ApiRouteError(
        "Attendance changed in another session. Refresh and try again.",
        409,
        "ATTENDANCE_VERSION_CONFLICT",
        { currentVersion: sheet.workflowVersion },
      );
    }
    await assertRosterUnchanged(sheet, session);

    const records = await AttendanceRecord.find({
      sheetId: sheet._id,
      enrollmentId: { $in: input.entries.map((entry) => entry.enrollmentId) },
    }).session(session);
    if (records.length !== input.entries.length) {
      throw new ApiRouteError(
        "One or more attendance entries are outside the frozen roster.",
        409,
        "ATTENDANCE_ROSTER_CHANGED",
      );
    }
    const recordByEnrollment = new Map(
      records.map((record) => [String(record.enrollmentId), record]),
    );
    const now = new Date();
    await AttendanceRecord.bulkWrite(
      input.entries.map((entry) => ({
        updateOne: {
          filter: { _id: recordByEnrollment.get(entry.enrollmentId)!._id },
          update: {
            $set: {
              status: entry.status,
              minutesLate: entry.status === "late" ? entry.minutesLate : undefined,
              privateNote: entry.privateNote || undefined,
              markedBy: new mongoose.Types.ObjectId(input.actor.id),
              markedAt: now,
            },
            $inc: { workflowVersion: 1 },
          },
        },
      })),
      { session },
    );

    const updatedSheet = await AttendanceSheet.findOneAndUpdate(
      { _id: sheet._id, status: "draft", workflowVersion: input.version },
      { $inc: { workflowVersion: 1 } },
      { new: true, session },
    );
    if (!updatedSheet) {
      throw new ApiRouteError(
        "Attendance changed in another session. Refresh and try again.",
        409,
        "ATTENDANCE_VERSION_CONFLICT",
      );
    }

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: sheet.organizationId,
      branchId: sheet.branchId,
      action: "attendance.records.marked",
      resourceType: "AttendanceSheet",
      resourceId: sheet._id,
      reason: input.reason,
      after: {
        changedCount: input.entries.length,
        statuses: input.entries.map((entry) => ({
          enrollmentId: entry.enrollmentId,
          status: entry.status,
        })),
        workflowVersion: updatedSheet.workflowVersion,
      },
      session,
    });

    return updatedSheet;
  });
}

export async function submitAttendance(
  input: AuditContext & { sheetId: string; version: number; idempotencyKey: string },
) {
  return runTransaction(async (session) => {
    const sheet = await AttendanceSheet.findById(input.sheetId).session(session);
    if (!sheet) throw new ApiRouteError("Attendance sheet was not found.", 404);
    assertAttendanceManager(input.actor, sheet.teacherId);

    const idempotency = await beginIdempotentWorkflow({
      organizationId: sheet.organizationId,
      actor: input.actor,
      workflow: "attendance.submit",
      targetId: input.sheetId,
      key: input.idempotencyKey,
      payload: { sheetId: input.sheetId, version: input.version },
    }, session);
    if (idempotency.replay) {
      return { sheet, replayed: true };
    }

    if (sheet.status === "submitted") {
      throw new ApiRouteError(
        "Attendance was already submitted.",
        409,
        "ATTENDANCE_ALREADY_SUBMITTED",
      );
    }
    if (sheet.workflowVersion !== input.version) {
      throw new ApiRouteError(
        "Attendance changed in another session. Refresh and try again.",
        409,
        "ATTENDANCE_VERSION_CONFLICT",
        { currentVersion: sheet.workflowVersion },
      );
    }
    await assertRosterUnchanged(sheet, session);

    const records = await AttendanceRecord.find({ sheetId: sheet._id }).session(session);
    const summary = calculateAttendanceSummary(records.map((record) => record.status));
    if (summary.counts.unmarked > 0) {
      throw new ApiRouteError(
        "Every roster member must be marked before submission.",
        409,
        "ATTENDANCE_UNMARKED_STUDENTS",
        { unmarkedCount: summary.counts.unmarked },
      );
    }

    const submittedAt = new Date();
    sheet.status = "submitted";
    sheet.workflowVersion += 1;
    sheet.submittedBy = new mongoose.Types.ObjectId(input.actor.id);
    sheet.submittedAt = submittedAt;
    sheet.summary = {
      present: summary.counts.present,
      absent: summary.counts.absent,
      late: summary.counts.late,
      excused: summary.counts.excused,
      attended: summary.attended,
      denominator: summary.denominator,
      percentage: summary.percentage ?? undefined,
    };
    await sheet.save({ session });

    await AttendanceOutbox.create([{
      eventId: randomUUID(),
      organizationId: sheet.organizationId,
      branchId: sheet.branchId,
      eventType: "attendance.sheet.submitted",
      aggregateId: String(sheet._id),
      payload: {
        sheetId: String(sheet._id),
        classSessionId: String(sheet.classSessionId),
        batchId: String(sheet.batchId),
        submittedAt: submittedAt.toISOString(),
        counts: sheet.summary,
      },
      status: "pending",
      occurredAt: submittedAt,
    }], { session });

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: sheet.organizationId,
      branchId: sheet.branchId,
      action: "attendance.sheet.submitted",
      resourceType: "AttendanceSheet",
      resourceId: sheet._id,
      reason: input.reason,
      before: { status: "draft", workflowVersion: input.version },
      after: { status: "submitted", workflowVersion: sheet.workflowVersion, summary: sheet.summary },
      session,
    });
    idempotency.record.status = "completed";
    idempotency.record.resultResourceId = String(sheet._id);
    await idempotency.record.save({ session });
    return { sheet, replayed: false };
  });
}

export async function amendSubmittedAttendance(
  input: AuditContext & {
    sheetId: string;
    version: number;
    entries: AttendanceMarkInput[];
    idempotencyKey: string;
  },
) {
  return runTransaction(async (session) => {
    const sheet = await AttendanceSheet.findById(input.sheetId).session(session);
    if (!sheet) throw new ApiRouteError("Attendance sheet was not found.", 404);
    assertAttendanceManager(input.actor, sheet.teacherId);
    if (sheet.status !== "submitted") {
      throw new ApiRouteError("Only submitted attendance can be amended.", 409);
    }

    const idempotency = await beginIdempotentWorkflow({
      organizationId: sheet.organizationId,
      actor: input.actor,
      workflow: "attendance.amend",
      targetId: input.sheetId,
      key: input.idempotencyKey,
      payload: { sheetId: input.sheetId, version: input.version, entries: input.entries },
    }, session);
    if (idempotency.replay) {
      return { sheet, changedCount: 0, replayed: true };
    }
    if (sheet.workflowVersion !== input.version) {
      throw new ApiRouteError(
        "Attendance changed in another session. Refresh and try again.",
        409,
        "ATTENDANCE_VERSION_CONFLICT",
        { currentVersion: sheet.workflowVersion },
      );
    }

    const records = await AttendanceRecord.find({
      sheetId: sheet._id,
      enrollmentId: { $in: input.entries.map((entry) => entry.enrollmentId) },
    }).session(session);
    if (records.length !== input.entries.length) {
      throw new ApiRouteError(
        "One or more attendance entries are outside the submitted roster.",
        409,
        "ATTENDANCE_ROSTER_CHANGED",
      );
    }

    const entryByEnrollment = new Map(
      input.entries.map((entry) => [entry.enrollmentId, entry]),
    );
    const changed = records.filter((record) => {
      const entry = entryByEnrollment.get(String(record.enrollmentId))!;
      const nextMinutesLate = entry.status === "late" ? entry.minutesLate : undefined;
      const nextPrivateNote = entry.privateNote === undefined
        ? record.privateNote
        : entry.privateNote || undefined;
      return record.status !== entry.status ||
        record.minutesLate !== nextMinutesLate ||
        record.privateNote !== nextPrivateNote;
    });
    if (changed.length === 0) {
      throw new ApiRouteError("The amendment does not change attendance.", 400, "VALIDATION_ERROR");
    }

    const now = new Date();
    const actorId = new mongoose.Types.ObjectId(input.actor.id);
    const corrections = [];
    for (const record of changed) {
      const entry = entryByEnrollment.get(String(record.enrollmentId))!;
      const before = {
        status: record.status as AttendanceStatus,
        minutesLate: record.minutesLate,
        privateNote: record.privateNote,
      };
      const after = {
        status: entry.status,
        minutesLate: entry.status === "late" ? entry.minutesLate : undefined,
        privateNote: entry.privateNote === undefined
          ? record.privateNote
          : entry.privateNote || undefined,
      };
      record.status = after.status;
      record.minutesLate = after.minutesLate;
      record.privateNote = after.privateNote;
      record.workflowVersion += 1;
      record.correctionVersion += 1;
      record.markedBy = actorId;
      record.markedAt = now;
      await record.save({ session });

      const [correction] = await AttendanceCorrection.create([{
        organizationId: sheet.organizationId,
        branchId: sheet.branchId,
        sheetId: sheet._id,
        recordId: record._id,
        sequence: record.correctionVersion,
        status: "approved",
        before,
        after,
        reason: input.reason,
        requestedBy: actorId,
        requestedAt: now,
        reviewedBy: actorId,
        reviewedAt: now,
        reviewReason: input.reason,
        requestId: getRequestId(input.request),
      }], { session });
      corrections.push(correction);
    }

    const allRecords = await AttendanceRecord.find({ sheetId: sheet._id }).session(session);
    const summary = calculateAttendanceSummary(allRecords.map((record) => record.status));
    const updatedSheet = await AttendanceSheet.findOneAndUpdate(
      { _id: sheet._id, status: "submitted", workflowVersion: input.version },
      {
        $inc: { workflowVersion: 1 },
        $set: {
          summary: {
            present: summary.counts.present,
            absent: summary.counts.absent,
            late: summary.counts.late,
            excused: summary.counts.excused,
            attended: summary.attended,
            denominator: summary.denominator,
            percentage: summary.percentage ?? undefined,
          },
        },
      },
      { new: true, session },
    );
    if (!updatedSheet) {
      throw new ApiRouteError(
        "Attendance changed in another session. Refresh and try again.",
        409,
        "ATTENDANCE_VERSION_CONFLICT",
      );
    }

    await AttendanceOutbox.insertMany(corrections.map((correction) => ({
      eventId: randomUUID(),
      organizationId: sheet.organizationId,
      branchId: sheet.branchId,
      eventType: "attendance.correction.approved" as const,
      aggregateId: String(sheet._id),
      payload: {
        sheetId: String(sheet._id),
        correctionId: String(correction._id),
        recordId: String(correction.recordId),
        sequence: correction.sequence,
        summary: updatedSheet.summary,
      },
      status: "pending" as const,
      occurredAt: now,
    })), { session });

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: sheet.organizationId,
      branchId: sheet.branchId,
      action: "attendance.sheet.amended",
      resourceType: "AttendanceSheet",
      resourceId: sheet._id,
      reason: input.reason,
      before: { workflowVersion: input.version, summary: sheet.summary },
      after: {
        workflowVersion: updatedSheet.workflowVersion,
        summary: updatedSheet.summary,
        changedCount: changed.length,
        correctionIds: corrections.map((correction) => String(correction._id)),
      },
      session,
    });
    idempotency.record.status = "completed";
    idempotency.record.resultResourceId = String(sheet._id);
    await idempotency.record.save({ session });
    return { sheet: updatedSheet, changedCount: changed.length, replayed: false };
  });
}

export async function requestAttendanceCorrection(
  input: AuditContext & {
    sheetId: string;
    recordId: string;
    status: AttendanceStatus;
    minutesLate?: number;
    privateNote?: string;
    idempotencyKey: string;
  },
) {
  return runTransaction(async (session) => {
    const sheet = await AttendanceSheet.findById(input.sheetId).session(session);
    if (!sheet) throw new ApiRouteError("Attendance sheet was not found.", 404);
    assertAttendanceManager(input.actor, sheet.teacherId);
    if (sheet.status !== "submitted") {
      throw new ApiRouteError("Only submitted attendance can be corrected.", 409);
    }
    const idempotency = await beginIdempotentWorkflow({
      organizationId: sheet.organizationId,
      actor: input.actor,
      workflow: "attendance.correction.request",
      targetId: input.recordId,
      key: input.idempotencyKey,
      payload: {
        sheetId: input.sheetId,
        recordId: input.recordId,
        status: input.status,
        minutesLate: input.minutesLate,
        privateNote: input.privateNote,
      },
    }, session);
    if (idempotency.replay && idempotency.record.resultResourceId) {
      const correction = await AttendanceCorrection.findById(
        idempotency.record.resultResourceId,
      ).session(session);
      if (correction) return { correction, replayed: true };
    }

    const record = await AttendanceRecord.findOneAndUpdate(
      { _id: input.recordId, sheetId: sheet._id, status: { $ne: "unmarked" } },
      { $inc: { correctionVersion: 1 } },
      { new: true, session },
    );
    if (!record || record.status === "unmarked") {
      throw new ApiRouteError("Attendance record was not found.", 404);
    }
    if (
      record.status === input.status &&
      record.minutesLate === input.minutesLate &&
      (record.privateNote ?? "") === (input.privateNote ?? "")
    ) {
      throw new ApiRouteError("The correction does not change attendance.", 400, "VALIDATION_ERROR");
    }

    const [correction] = await AttendanceCorrection.create([{
      organizationId: sheet.organizationId,
      branchId: sheet.branchId,
      sheetId: sheet._id,
      recordId: record._id,
      sequence: record.correctionVersion,
      status: "pending",
      before: {
        status: record.status,
        minutesLate: record.minutesLate,
        privateNote: record.privateNote,
      },
      after: {
        status: input.status,
        minutesLate: input.status === "late" ? input.minutesLate : undefined,
        privateNote: input.privateNote || undefined,
      },
      reason: input.reason,
      requestedBy: input.actor.id,
      requestedAt: new Date(),
      requestId: getRequestId(input.request),
    }], { session });

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: sheet.organizationId,
      branchId: sheet.branchId,
      action: "attendance.correction.requested",
      resourceType: "AttendanceCorrection",
      resourceId: correction._id,
      reason: input.reason,
      before: { status: record.status },
      after: { status: input.status, sequence: correction.sequence },
      session,
    });
    idempotency.record.status = "completed";
    idempotency.record.resultResourceId = String(correction._id);
    await idempotency.record.save({ session });
    return { correction, replayed: false };
  });
}

export async function reviewAttendanceCorrection(
  input: AuditContext & {
    correctionId: string;
    action: "approve" | "reject";
    idempotencyKey: string;
  },
) {
  if (input.actor.role !== "admin") {
    throw new ApiRouteError(
      "Only an administrator can review attendance corrections.",
      403,
      "ATTENDANCE_CORRECTION_FORBIDDEN",
    );
  }
  return runTransaction(async (session) => {
    const correction = await AttendanceCorrection.findById(input.correctionId).session(session);
    if (!correction) throw new ApiRouteError("Attendance correction was not found.", 404);
    if (String(correction.requestedBy) === input.actor.id) {
      throw new ApiRouteError(
        "A correction requester cannot approve or reject their own request.",
        403,
        "ATTENDANCE_CORRECTION_FORBIDDEN",
      );
    }

    const idempotency = await beginIdempotentWorkflow({
      organizationId: correction.organizationId,
      actor: input.actor,
      workflow: "attendance.correction.review",
      targetId: input.correctionId,
      key: input.idempotencyKey,
      payload: { correctionId: input.correctionId, action: input.action },
    }, session);
    if (idempotency.replay) return { correction, replayed: true };
    if (correction.status !== "pending") {
      throw new ApiRouteError("Attendance correction was already reviewed.", 409);
    }

    const sheet = await AttendanceSheet.findById(correction.sheetId).session(session);
    const record = await AttendanceRecord.findById(correction.recordId).session(session);
    if (!sheet || !record) throw new ApiRouteError("Attendance correction context is missing.", 409);

    correction.status = input.action === "approve" ? "approved" : "rejected";
    correction.reviewedBy = new mongoose.Types.ObjectId(input.actor.id);
    correction.reviewedAt = new Date();
    correction.reviewReason = input.reason;

    if (input.action === "approve") {
      record.status = correction.after.status;
      record.minutesLate = correction.after.status === "late"
        ? correction.after.minutesLate
        : undefined;
      record.privateNote = correction.after.privateNote;
      record.workflowVersion += 1;
      record.markedBy = new mongoose.Types.ObjectId(input.actor.id);
      record.markedAt = correction.reviewedAt;
      await record.save({ session });

      const records = await AttendanceRecord.find({ sheetId: sheet._id }).session(session);
      const summary = calculateAttendanceSummary(records.map((item) => item.status));
      sheet.workflowVersion += 1;
      sheet.summary = {
        present: summary.counts.present,
        absent: summary.counts.absent,
        late: summary.counts.late,
        excused: summary.counts.excused,
        attended: summary.attended,
        denominator: summary.denominator,
        percentage: summary.percentage ?? undefined,
      };
      await sheet.save({ session });

      await AttendanceOutbox.create([{
        eventId: randomUUID(),
        organizationId: sheet.organizationId,
        branchId: sheet.branchId,
        eventType: "attendance.correction.approved",
        aggregateId: String(sheet._id),
        payload: {
          sheetId: String(sheet._id),
          correctionId: String(correction._id),
          recordId: String(record._id),
          sequence: correction.sequence,
          summary: sheet.summary,
        },
        status: "pending",
        occurredAt: correction.reviewedAt,
      }], { session });
    }

    await correction.save({ session });
    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: correction.organizationId,
      branchId: correction.branchId,
      action: `attendance.correction.${correction.status}`,
      resourceType: "AttendanceCorrection",
      resourceId: correction._id,
      reason: input.reason,
      before: { status: "pending" },
      after: { status: correction.status, sequence: correction.sequence },
      session,
    });
    idempotency.record.status = "completed";
    idempotency.record.resultResourceId = String(correction._id);
    await idempotency.record.save({ session });
    return { correction, replayed: false };
  });
}
