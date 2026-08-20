import mongoose, { type ClientSession } from "mongoose";
import type { NextRequest } from "next/server";

import type { SessionUser } from "../types/index.ts";
import { calculateCoachingFee, normalizeSubjectIds } from "./coaching-rules.ts";
import { ApiRouteError } from "./api-error.ts";
import { writeAuditLog } from "./audit/write-audit-log.ts";
import { AcademicSubject } from "./db/models/AcademicSubject.ts";
import { Batch } from "./db/models/Batch.ts";
import { BatchEnrollment } from "./db/models/BatchEnrollment.ts";
import { CoachingBatchSubject } from "./db/models/CoachingBatchSubject.ts";
import { CoachingEnrollmentSubject } from "./db/models/CoachingEnrollmentSubject.ts";
import { PaymentProfile } from "./db/models/PaymentProfile.ts";
import { User } from "./db/models/User.ts";

type AuditInput = { request: NextRequest; actor: SessionUser; reason: string };

async function inTransaction<T>(work: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => { result = await work(session); });
  } finally {
    await session.endSession();
  }
  if (result === undefined) throw new ApiRouteError("Coaching enrollment did not complete.", 500);
  return result;
}

async function loadSelection(
  batchId: string | mongoose.Types.ObjectId,
  requestedSubjectIds: readonly string[] | undefined,
  session: ClientSession,
) {
  const batch = await Batch.findOne({
    _id: batchId,
    status: { $in: ["planned", "active"] },
  }).session(session);
  if (!batch) throw new ApiRouteError("Batch not found or inactive.", 404);

  const configured = await CoachingBatchSubject.find({ batchId: batch._id, status: "active" })
    .sort({ sortOrder: 1, createdAt: 1 })
    .session(session)
    .lean();
  if (configured.length === 0) {
    throw new ApiRouteError("এই ব্যাচে কোচিং বিষয় ও ফি এখনো কনফিগার করা হয়নি।", 409, "COACHING_PRICING_MISSING");
  }
  const selectedSubjectIds = normalizeSubjectIds(
    requestedSubjectIds === undefined
      ? configured.map((item) => String(item.subjectId))
      : requestedSubjectIds,
  );
  if (selectedSubjectIds.length === 0) {
    throw new ApiRouteError("অন্তত একটি কোচিং বিষয় নির্বাচন করুন।", 400, "VALIDATION_ERROR");
  }
  let monthlyFeeTk: number;
  try {
    monthlyFeeTk = calculateCoachingFee(
      configured.map((item) => ({ subjectId: String(item.subjectId), monthlyFeeTk: item.monthlyFeeTk })),
      selectedSubjectIds,
      batch.fullPackageFeeTk,
    );
  } catch {
    throw new ApiRouteError("নির্বাচিত বিষয়ের ফি কনফিগার করা নেই।", 409, "COACHING_PRICING_MISSING");
  }
  return { batch, configured, selectedSubjectIds, monthlyFeeTk };
}

async function syncPaymentProfile(input: {
  studentId: mongoose.Types.ObjectId;
  subjectIds: string[];
  monthlyFeeTk: number;
  actorId: string;
  session: ClientSession;
  active?: boolean;
}) {
  const subjects = await AcademicSubject.find({ _id: { $in: input.subjectIds } })
    .select("nameBn name")
    .session(input.session)
    .lean();
  await PaymentProfile.findOneAndUpdate(
    { userId: input.studentId },
    {
      $set: {
        role: "student",
        subjects: subjects.map((subject) => subject.nameBn || subject.name),
        defaultAmountTk: input.monthlyFeeTk,
        isActive: input.active ?? true,
        updatedBy: input.actorId,
      },
    },
    { upsert: true, runValidators: true, session: input.session },
  );
}

async function addSubjectRows(input: {
  enrollment: { _id: mongoose.Types.ObjectId; organizationId: mongoose.Types.ObjectId; branchId: mongoose.Types.ObjectId; batchId: mongoose.Types.ObjectId; studentId: mongoose.Types.ObjectId };
  subjectIds: string[];
  effectiveFrom: Date;
  actorId: string;
  session: ClientSession;
}) {
  await CoachingEnrollmentSubject.insertMany(
    input.subjectIds.map((subjectId) => ({
      organizationId: input.enrollment.organizationId,
      branchId: input.enrollment.branchId,
      batchId: input.enrollment.batchId,
      enrollmentId: input.enrollment._id,
      studentId: input.enrollment.studentId,
      subjectId,
      status: "active",
      effectiveFrom: input.effectiveFrom,
      createdBy: input.actorId,
    })),
    { session: input.session },
  );
}

export async function createCoachingEnrollment(input: AuditInput & {
  batchId: string;
  studentId: string;
  subjectIds?: string[];
  effectiveFrom: Date;
}) {
  return inTransaction(async (session) => {
    const { batch, selectedSubjectIds, monthlyFeeTk } = await loadSelection(input.batchId, input.subjectIds, session);
    const student = await User.findOne({ _id: input.studentId, role: "student", isActive: true }).session(session);
    if (!student) throw new ApiRouteError("Active student not found.", 404);
    if (student.studentClass !== batch.studentClass) throw new ApiRouteError("Student class does not match the batch class.", 409);
    if (input.effectiveFrom < batch.startsAt || input.effectiveFrom > batch.endsAt) {
      throw new ApiRouteError("Enrollment date must fall within the batch dates.", 409);
    }
    const exists = await BatchEnrollment.exists({
      organizationId: batch.organizationId,
      academicSessionId: batch.academicSessionId,
      studentId: student._id,
      status: "active",
    }).session(session);
    if (exists) throw new ApiRouteError("Student already has an active coaching enrollment in this session.", 409);
    const reserved = await Batch.findOneAndUpdate(
      { _id: batch._id, status: { $in: ["planned", "active"] }, $or: [{ activeEnrollmentCount: { $lt: batch.capacity } }, { activeEnrollmentCount: { $exists: false } }] },
      { $inc: { activeEnrollmentCount: 1 } },
      { new: true, session },
    );
    if (!reserved) throw new ApiRouteError("Batch capacity has been reached.", 409);
    const [enrollment] = await BatchEnrollment.create([{
      organizationId: batch.organizationId,
      branchId: batch.branchId,
      academicSessionId: batch.academicSessionId,
      batchId: batch._id,
      studentId: student._id,
      status: "active",
      effectiveFrom: input.effectiveFrom,
      monthlyFeeTk,
      feeCalculatedAt: new Date(),
      createdBy: input.actor.id,
    }], { session });
    await addSubjectRows({ enrollment, subjectIds: selectedSubjectIds, effectiveFrom: input.effectiveFrom, actorId: input.actor.id, session });
    await syncPaymentProfile({ studentId: student._id, subjectIds: selectedSubjectIds, monthlyFeeTk, actorId: input.actor.id, session });
    await User.updateOne({ _id: student._id }, { $set: { isAbspMember: true } }, { session });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: batch.organizationId, branchId: batch.branchId,
      action: "coaching.enrollment.created", resourceType: "BatchEnrollment", resourceId: enrollment._id, reason: input.reason,
      after: { batchId: String(batch._id), studentId: String(student._id), subjectIds: selectedSubjectIds, monthlyFeeTk }, session,
    });
    return enrollment;
  });
}

export async function updateCoachingSubjects(input: AuditInput & {
  enrollmentId: string;
  subjectIds: string[];
  effectiveAt: Date;
}) {
  return inTransaction(async (session) => {
    const enrollment = await BatchEnrollment.findOne({ _id: input.enrollmentId, status: "active" }).session(session);
    if (!enrollment) throw new ApiRouteError("Active coaching enrollment not found.", 404);
    const { selectedSubjectIds, monthlyFeeTk } = await loadSelection(enrollment.batchId, input.subjectIds, session);
    const activeRows = await CoachingEnrollmentSubject.find({ enrollmentId: enrollment._id, status: "active" }).session(session);
    const currentIds = activeRows.map((row) => String(row.subjectId));
    const previousMonthlyFeeTk = enrollment.monthlyFeeTk;
    const removed = activeRows.filter((row) => !selectedSubjectIds.includes(String(row.subjectId)));
    const added = selectedSubjectIds.filter((subjectId) => !currentIds.includes(subjectId));
    if (removed.length) {
      await CoachingEnrollmentSubject.updateMany(
        { _id: { $in: removed.map((row) => row._id) } },
        { $set: { status: "dropped", effectiveTo: input.effectiveAt, endReason: input.reason } },
        { session },
      );
    }
    if (added.length) await addSubjectRows({ enrollment, subjectIds: added, effectiveFrom: input.effectiveAt, actorId: input.actor.id, session });
    enrollment.monthlyFeeTk = monthlyFeeTk;
    enrollment.feeCalculatedAt = new Date();
    await enrollment.save({ session });
    await syncPaymentProfile({ studentId: enrollment.studentId, subjectIds: selectedSubjectIds, monthlyFeeTk, actorId: input.actor.id, session });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: enrollment.organizationId, branchId: enrollment.branchId,
      action: "coaching.enrollment.subjects-updated", resourceType: "BatchEnrollment", resourceId: enrollment._id, reason: input.reason,
      before: { subjectIds: currentIds, monthlyFeeTk: previousMonthlyFeeTk },
      after: { subjectIds: selectedSubjectIds, monthlyFeeTk }, session,
    });
    return enrollment;
  });
}

export async function transferCoachingEnrollment(input: AuditInput & {
  enrollmentId: string;
  targetBatchId: string;
  subjectIds?: string[];
  effectiveAt: Date;
}) {
  return inTransaction(async (session) => {
    const current = await BatchEnrollment.findOne({ _id: input.enrollmentId, status: "active" }).session(session);
    if (!current) throw new ApiRouteError("Active coaching enrollment not found.", 404);
    if (String(current.batchId) === input.targetBatchId) throw new ApiRouteError("Student is already in the target batch.", 409);
    const [currentBatch, selection] = await Promise.all([
      Batch.findById(current.batchId).session(session),
      loadSelection(input.targetBatchId, input.subjectIds, session),
    ]);
    if (!currentBatch) throw new ApiRouteError("Current batch not found.", 409);
    const { batch: targetBatch, selectedSubjectIds, monthlyFeeTk } = selection;
    if (
      String(targetBatch.organizationId) !== String(current.organizationId) ||
      String(targetBatch.academicSessionId) !== String(current.academicSessionId) ||
      targetBatch.studentClass !== currentBatch.studentClass
    ) throw new ApiRouteError("Transfer target must use the same organization, session, and class.", 409);
    const reserved = await Batch.findOneAndUpdate(
      { _id: targetBatch._id, status: { $in: ["planned", "active"] }, $or: [{ activeEnrollmentCount: { $lt: targetBatch.capacity } }, { activeEnrollmentCount: { $exists: false } }] },
      { $inc: { activeEnrollmentCount: 1 } },
      { new: true, session },
    );
    if (!reserved) throw new ApiRouteError("Target batch capacity has been reached.", 409);
    current.status = "transferred"; current.effectiveTo = input.effectiveAt; current.endReason = input.reason;
    await current.save({ session });
    await CoachingEnrollmentSubject.updateMany(
      { enrollmentId: current._id, status: "active" },
      { $set: { status: "dropped", effectiveTo: input.effectiveAt, endReason: input.reason } },
      { session },
    );
    await Batch.updateOne({ _id: current.batchId, activeEnrollmentCount: { $gt: 0 } }, { $inc: { activeEnrollmentCount: -1 } }, { session });
    const [next] = await BatchEnrollment.create([{
      organizationId: targetBatch.organizationId, branchId: targetBatch.branchId, academicSessionId: targetBatch.academicSessionId,
      batchId: targetBatch._id, studentId: current.studentId, status: "active", effectiveFrom: input.effectiveAt,
      monthlyFeeTk, feeCalculatedAt: new Date(), createdBy: input.actor.id,
    }], { session });
    await addSubjectRows({ enrollment: next, subjectIds: selectedSubjectIds, effectiveFrom: input.effectiveAt, actorId: input.actor.id, session });
    await syncPaymentProfile({ studentId: current.studentId, subjectIds: selectedSubjectIds, monthlyFeeTk, actorId: input.actor.id, session });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: current.organizationId, branchId: targetBatch.branchId,
      action: "coaching.enrollment.transferred", resourceType: "BatchEnrollment", resourceId: current._id, reason: input.reason,
      before: { batchId: String(current.batchId), status: "active" },
      after: { batchId: String(targetBatch._id), nextEnrollmentId: String(next._id), subjectIds: selectedSubjectIds, monthlyFeeTk }, session,
    });
    return next;
  });
}

export async function withdrawCoachingEnrollment(input: AuditInput & { enrollmentId: string; effectiveAt: Date }) {
  return inTransaction(async (session) => {
    const enrollment = await BatchEnrollment.findOne({ _id: input.enrollmentId, status: "active" }).session(session);
    if (!enrollment) throw new ApiRouteError("Active coaching enrollment not found.", 404);
    enrollment.status = "withdrawn";
    enrollment.effectiveTo = input.effectiveAt;
    enrollment.endReason = input.reason;
    await enrollment.save({ session });
    await CoachingEnrollmentSubject.updateMany(
      { enrollmentId: enrollment._id, status: "active" },
      { $set: { status: "dropped", effectiveTo: input.effectiveAt, endReason: input.reason } },
      { session },
    );
    await Batch.updateOne({ _id: enrollment.batchId, activeEnrollmentCount: { $gt: 0 } }, { $inc: { activeEnrollmentCount: -1 } }, { session });
    await syncPaymentProfile({ studentId: enrollment.studentId, subjectIds: [], monthlyFeeTk: 0, actorId: input.actor.id, session, active: false });
    const another = await BatchEnrollment.exists({ studentId: enrollment.studentId, status: "active" }).session(session);
    if (!another) await User.updateOne({ _id: enrollment.studentId }, { $set: { isAbspMember: false } }, { session });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: enrollment.organizationId, branchId: enrollment.branchId,
      action: "coaching.enrollment.withdrawn", resourceType: "BatchEnrollment", resourceId: enrollment._id, reason: input.reason,
      before: { status: "active" }, after: { status: "withdrawn", effectiveTo: input.effectiveAt.toISOString() }, session,
    });
    return enrollment;
  });
}
