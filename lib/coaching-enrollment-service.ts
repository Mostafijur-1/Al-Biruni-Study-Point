import mongoose, { type ClientSession } from "mongoose";
import type { NextRequest } from "next/server";

import type { SessionUser } from "../types/index.ts";
import { normalizeSubjectIds } from "./coaching-rules.ts";
import { ApiRouteError } from "./api-error.ts";
import { writeAuditLog } from "./audit/write-audit-log.ts";
import { AcademicSubject } from "./db/models/AcademicSubject.ts";
import { Batch } from "./db/models/Batch.ts";
import { BatchEnrollment } from "./db/models/BatchEnrollment.ts";
import { CoachingBatchSubject } from "./db/models/CoachingBatchSubject.ts";
import { CoachingEnrollmentSubject } from "./db/models/CoachingEnrollmentSubject.ts";
import { PaymentProfile } from "./db/models/PaymentProfile.ts";
import { User } from "./db/models/User.ts";
import { StudentCodeCounter } from "./db/models/StudentCodeCounter.ts";
import { formatStudentCode, getStudentCodePrefix, isSevenDigitStudentCode, parseStudentCodeSequence, suggestNextFromLastCode, suggestNextStudentCode } from "./student-code.ts";

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
    throw new ApiRouteError("এই ব্যাচে কোচিং বিষয় এখনো কনফিগার করা হয়নি।", 409, "CONFLICT");
  }
  const selectedSubjectIds = normalizeSubjectIds(
    requestedSubjectIds === undefined
      ? configured.map((item) => String(item.subjectId))
      : requestedSubjectIds,
  );
  if (selectedSubjectIds.length === 0) {
    throw new ApiRouteError("অন্তত একটি কোচিং বিষয় নির্বাচন করুন।", 400, "VALIDATION_ERROR");
  }
  const configuredIds = new Set(configured.map((item) => String(item.subjectId)));
  if (selectedSubjectIds.some((subjectId) => !configuredIds.has(subjectId))) {
    throw new ApiRouteError("নির্বাচিত এক বা একাধিক বিষয় এই ব্যাচে নেই।", 409, "CONFLICT");
  }
  return { batch, configured, selectedSubjectIds };
}

async function syncPaymentProfile(input: {
  studentId: mongoose.Types.ObjectId;
  subjectIds: string[];
  feeTk?: number;
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
        ...(input.feeTk !== undefined ? { defaultAmountTk: input.feeTk } : {}),
        isActive: input.active ?? true,
        updatedBy: input.actorId,
      },
      ...(input.feeTk === undefined ? { $setOnInsert: { defaultAmountTk: 0 } } : {}),
    },
    { upsert: true, runValidators: true, session: input.session, setDefaultsOnInsert: true },
  );
}

async function addSubjectRows(input: {
  enrollment: { _id: mongoose.Types.ObjectId; organizationId?: mongoose.Types.ObjectId; branchId?: mongoose.Types.ObjectId; batchId: mongoose.Types.ObjectId; studentId: mongoose.Types.ObjectId };
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

async function syncStudentCodeCounter(input: {
  prefix: string;
  sequence: number;
  session: ClientSession;
}) {
  const counter = await StudentCodeCounter.findOne({ prefix: input.prefix }).session(input.session);
  if ((counter?.sequence ?? 0) >= input.sequence) return;
  await StudentCodeCounter.findOneAndUpdate(
    { prefix: input.prefix },
    { $set: { sequence: input.sequence }, $setOnInsert: { prefix: input.prefix } },
    { upsert: true, session: input.session },
  );
}

function studentMatchesBatchClass(
  student: { studentClass?: string },
  batch: { studentClass?: string },
) {
  if (!batch.studentClass || !student.studentClass) return true;
  return student.studentClass === batch.studentClass;
}

function codeTakenFilter(studentCode: string, excludeStudentId?: mongoose.Types.ObjectId) {
  return {
    ...(excludeStudentId ? { _id: { $ne: excludeStudentId } } : {}),
    studentCode,
  };
}

async function lastSequenceForPrefix(prefix: string, session?: ClientSession) {
  const counterQuery = StudentCodeCounter.findOne({ prefix });
  const assignedQuery = User.find({ studentCode: new RegExp(`^${prefix}\\d{2}$`) }).select("studentCode");
  const [counter, assigned] = await Promise.all([
    session ? counterQuery.session(session).lean() : counterQuery.lean(),
    session ? assignedQuery.session(session).lean() : assignedQuery.lean(),
  ]);
  const latestSequence = assigned.reduce((max, student) => {
    const sequence = parseStudentCodeSequence(String(student.studentCode ?? ""), prefix) ?? 0;
    return Math.max(max, sequence);
  }, 0);
  return Math.max(counter?.sequence ?? 0, latestSequence);
}

async function lastSevenDigitCodeForBatch(batchId: mongoose.Types.ObjectId, session?: ClientSession) {
  const enrollmentQuery = BatchEnrollment.find({ batchId, status: "active" }).select("studentId");
  const enrollments = session ? await enrollmentQuery.session(session).lean() : await enrollmentQuery.lean();
  if (enrollments.length === 0) return null;
  const studentsQuery = User.find({
    _id: { $in: enrollments.map((row) => row.studentId) },
    studentCode: { $nin: [null, ""] },
  }).select("studentCode");
  const students = session ? await studentsQuery.session(session).lean() : await studentsQuery.lean();
  const codes = students
    .map((student) => String(student.studentCode ?? ""))
    .filter(isSevenDigitStudentCode)
    .sort();
  return codes.at(-1) ?? null;
}

async function persistNewStudentCode(input: {
  student: InstanceType<typeof User>;
  studentCode: string;
  session: ClientSession;
}) {
  const result = await User.collection.updateOne(
    {
      _id: input.student._id,
      $or: [{ studentCode: { $exists: false } }, { studentCode: null }, { studentCode: "" }],
    },
    { $set: { studentCode: input.studentCode, updatedAt: new Date() } },
    { session: input.session },
  );
  if (result.matchedCount === 0) {
    const current = await User.findById(input.student._id).select("studentCode").session(input.session);
    const currentCode = current?.studentCode == null || current.studentCode === "" ? "" : String(current.studentCode);
    if (currentCode === input.studentCode) {
      input.student.studentCode = input.studentCode;
      return input.studentCode;
    }
    if (currentCode) {
      throw new ApiRouteError("Student already has a permanent ID that cannot be changed.", 409, "CONFLICT");
    }
    const retry = await User.collection.updateOne(
      { _id: input.student._id },
      { $set: { studentCode: input.studentCode, updatedAt: new Date() } },
      { session: input.session },
    );
    if (retry.matchedCount === 0) {
      throw new ApiRouteError("Permanent Student ID could not be saved.", 500);
    }
  }
  input.student.studentCode = input.studentCode;
  return input.studentCode;
}

async function assignManualStudentCode(input: {
  student: InstanceType<typeof User>;
  batch: InstanceType<typeof Batch>;
  requestedCode: string;
  session: ClientSession;
}) {
  if (!isSevenDigitStudentCode(input.requestedCode)) {
    throw new ApiRouteError("Student ID must be a 7-digit number.", 400, "VALIDATION_ERROR");
  }
  const prefix = getStudentCodePrefix(input.batch);
  if (prefix && !input.requestedCode.startsWith(prefix)) {
    throw new ApiRouteError(`Student ID must be 7 digits and start with ${prefix}.`, 400, "VALIDATION_ERROR");
  }
  const taken = await User.exists(codeTakenFilter(input.requestedCode, input.student._id)).session(input.session);
  if (taken) throw new ApiRouteError("This Student ID is already assigned to another student.", 409, "CONFLICT");
  await persistNewStudentCode({
    student: input.student,
    studentCode: input.requestedCode,
    session: input.session,
  });
  if (prefix) {
    const sequence = parseStudentCodeSequence(input.requestedCode, prefix);
    if (sequence) await syncStudentCodeCounter({ prefix, sequence, session: input.session });
  }
  return input.requestedCode;
}

async function assignPermanentStudentCode(input: {
  student: InstanceType<typeof User>;
  batch: InstanceType<typeof Batch>;
  session: ClientSession;
  requestedCode?: string;
}) {
  if (input.student.studentCode) return input.student.studentCode;
  if (input.requestedCode) {
    return assignManualStudentCode({
      student: input.student,
      batch: input.batch,
      requestedCode: input.requestedCode,
      session: input.session,
    });
  }
  const prefix = getStudentCodePrefix(input.batch);
  if (!prefix) {
    throw new ApiRouteError(
      "Enter a 7-digit Student ID. Batch name or code should include a four-digit year so the next ID can be suggested automatically.",
      409,
      "CONFLICT",
    );
  }
  let sequence = (await lastSequenceForPrefix(prefix, input.session)) + 1;
  while (sequence <= 99) {
    const candidate = formatStudentCode(prefix, sequence);
    const taken = await User.exists(codeTakenFilter(candidate)).session(input.session);
    if (!taken) {
      await persistNewStudentCode({ student: input.student, studentCode: candidate, session: input.session });
      await syncStudentCodeCounter({ prefix, sequence, session: input.session });
      return candidate;
    }
    sequence += 1;
  }
  throw new ApiRouteError("No remaining Student IDs are available for this batch prefix.", 409, "CONFLICT");
}

export async function getStudentCodeContextForBatch(batchId: string) {
  const batch = await Batch.findOne({ _id: batchId, status: { $in: ["planned", "active"] } }).lean();
  if (!batch) throw new ApiRouteError("Batch not found or inactive.", 404);
  const prefix = getStudentCodePrefix(batch);
  const lastInBatch = await lastSevenDigitCodeForBatch(batch._id);
  if (!prefix) {
    return {
      prefix: null as string | null,
      lastStudentCode: lastInBatch,
      nextStudentCode: lastInBatch ? suggestNextFromLastCode(lastInBatch) : null,
      yearRequired: true,
    };
  }
  const lastSequence = await lastSequenceForPrefix(prefix);
  const lastFromPrefix = lastSequence > 0 ? formatStudentCode(prefix, lastSequence) : null;
  const lastStudentCode = [lastFromPrefix, lastInBatch].filter(Boolean).sort().at(-1) ?? null;
  return {
    prefix,
    lastStudentCode,
    nextStudentCode: suggestNextStudentCode(prefix, lastSequence) ?? (lastStudentCode ? suggestNextFromLastCode(lastStudentCode) : null),
    yearRequired: false,
  };
}

export async function assignStudentCodeForBatch(input: AuditInput & {
  batchId: string;
  studentId: string;
  studentCode?: string;
}) {
  if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can assign student IDs.", 403);
  return inTransaction(async (session) => {
    const student = await User.findOne({ _id: input.studentId, role: "student", isActive: true }).session(session);
    const batch = await Batch.findOne({ _id: input.batchId, status: { $in: ["planned", "active"] } }).session(session);
    if (!student) throw new ApiRouteError("Active student not found.", 404);
    if (!batch) throw new ApiRouteError("Batch not found or inactive.", 404);
    if (!studentMatchesBatchClass(student, batch)) {
      throw new ApiRouteError("Student class does not match the batch class.", 409);
    }
    if (student.studentCode) {
      if (input.studentCode && input.studentCode !== student.studentCode) {
        throw new ApiRouteError("Student already has a permanent ID that cannot be changed.", 409, "CONFLICT");
      }
      return { studentCode: student.studentCode, newlyAssigned: false };
    }
    const studentCode = await assignPermanentStudentCode({
      student,
      batch,
      session,
      requestedCode: input.studentCode,
    });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: batch.organizationId, branchId: batch.branchId,
      action: "coaching.student-code.assigned", resourceType: "User", resourceId: student._id, reason: input.reason,
      after: { batchId: String(batch._id), studentCode, manual: Boolean(input.studentCode) }, session,
    });
    return { studentCode, newlyAssigned: true };
  });
}

export async function createCoachingEnrollment(input: AuditInput & {
  batchId: string;
  studentId: string;
  subjectIds?: string[];
  studentCode?: string;
  effectiveFrom: Date;
  feeTk: number;
  guardianPhone: string;
  guardianRelation: "father" | "mother" | "brother" | "sister" | "uncle" | "aunt" | "other";
}) {
  return inTransaction(async (session) => {
    const { batch, selectedSubjectIds } = await loadSelection(input.batchId, input.subjectIds, session);
    const student = await User.findOne({ _id: input.studentId, role: "student", isActive: true }).session(session);
    if (!student) throw new ApiRouteError("Active student not found.", 404);
    if (!studentMatchesBatchClass(student, batch)) throw new ApiRouteError("Student class does not match the batch class.", 409);
    const effectiveFrom = batch.startsAt && input.effectiveFrom < batch.startsAt
      ? batch.startsAt
      : input.effectiveFrom;
    if (batch.endsAt && effectiveFrom > batch.endsAt) {
      throw new ApiRouteError("Enrollment date cannot be after the batch end date.", 409);
    }
    const exists = await BatchEnrollment.exists({
      studentId: student._id,
      status: "active",
    }).session(session);
    if (exists) throw new ApiRouteError("Student already has an active coaching enrollment in this session.", 409);
    const studentCode = await assignPermanentStudentCode({
      student,
      batch,
      session,
      requestedCode: input.studentCode,
    });
    const reserved = await Batch.findOneAndUpdate(
      { _id: batch._id, status: { $in: ["planned", "active"] }, ...(batch.capacity ? { $or: [{ activeEnrollmentCount: { $lt: batch.capacity } }, { activeEnrollmentCount: { $exists: false } }] } : {}) },
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
      effectiveFrom,
      guardianPhone: input.guardianPhone,
      guardianRelation: input.guardianRelation,
      createdBy: input.actor.id,
    }], { session });
    await addSubjectRows({ enrollment, subjectIds: selectedSubjectIds, effectiveFrom, actorId: input.actor.id, session });
    await syncPaymentProfile({ studentId: student._id, subjectIds: selectedSubjectIds, feeTk: input.feeTk, actorId: input.actor.id, session });
    await User.updateOne({ _id: student._id }, { $set: { isAbspMember: true } }, { session });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: batch.organizationId, branchId: batch.branchId,
      action: "coaching.enrollment.created", resourceType: "BatchEnrollment", resourceId: enrollment._id, reason: input.reason,
      after: { batchId: String(batch._id), studentId: String(student._id), studentCode, subjectIds: selectedSubjectIds, feeTk: input.feeTk, guardianRelation: input.guardianRelation, effectiveFrom: effectiveFrom.toISOString() }, session,
    });
    return enrollment;
  });
}

export async function assignMissingStudentCodes(input: AuditInput) {
  if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can assign student IDs.", 403);
  return inTransaction(async (session) => {
    const enrollments = await BatchEnrollment.find({ status: "active" })
      .sort({ effectiveFrom: 1, createdAt: 1 })
      .session(session);
    const assigned: string[] = [];
    const skippedBatchIds = new Set<string>();
    for (const enrollment of enrollments) {
      const student = await User.findOne({ _id: enrollment.studentId, role: "student" }).session(session);
      const batch = await Batch.findById(enrollment.batchId).session(session);
      if (!student || student.studentCode || !batch) continue;
      if (!getStudentCodePrefix(batch)) {
        skippedBatchIds.add(String(batch._id));
        continue;
      }
      assigned.push(await assignPermanentStudentCode({ student, batch, session }));
    }
    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      action: "coaching.student-codes.backfilled",
      resourceType: "User",
      resourceId: "bulk-student-code-assignment",
      reason: input.reason,
      after: { assignedCount: assigned.length, assigned, skippedBatchIds: [...skippedBatchIds] },
      session,
    });
    return { assigned, skippedBatchIds: [...skippedBatchIds] };
  });
}

export async function updateCoachingSubjects(input: AuditInput & {
  enrollmentId: string;
  subjectIds: string[];
  effectiveAt: Date;
  feeTk: number;
  guardianPhone?: string;
  guardianRelation?: "father" | "mother" | "brother" | "sister" | "uncle" | "aunt" | "other";
}) {
  return inTransaction(async (session) => {
    const enrollment = await BatchEnrollment.findOne({ _id: input.enrollmentId, status: "active" }).session(session);
    if (!enrollment) throw new ApiRouteError("Active coaching enrollment not found.", 404);
    const { selectedSubjectIds } = await loadSelection(enrollment.batchId, input.subjectIds, session);
    const activeRows = await CoachingEnrollmentSubject.find({ enrollmentId: enrollment._id, status: "active" }).session(session);
    const currentIds = activeRows.map((row) => String(row.subjectId));
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
    if (input.guardianPhone) enrollment.guardianPhone = input.guardianPhone;
    if (input.guardianRelation) enrollment.guardianRelation = input.guardianRelation;
    await enrollment.save({ session });
    await syncPaymentProfile({ studentId: enrollment.studentId, subjectIds: selectedSubjectIds, feeTk: input.feeTk, actorId: input.actor.id, session });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: enrollment.organizationId, branchId: enrollment.branchId,
      action: "coaching.enrollment.subjects-updated", resourceType: "BatchEnrollment", resourceId: enrollment._id, reason: input.reason,
      before: { subjectIds: currentIds },
      after: { subjectIds: selectedSubjectIds, feeTk: input.feeTk }, session,
    });
    return enrollment;
  });
}

export async function transferCoachingEnrollment(input: AuditInput & {
  enrollmentId: string;
  targetBatchId: string;
  subjectIds?: string[];
  effectiveAt: Date;
  feeTk: number;
  guardianPhone?: string;
  guardianRelation?: "father" | "mother" | "brother" | "sister" | "uncle" | "aunt" | "other";
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
    const { batch: targetBatch, selectedSubjectIds } = selection;
    const reserved = await Batch.findOneAndUpdate(
      { _id: targetBatch._id, status: { $in: ["planned", "active"] }, ...(targetBatch.capacity ? { $or: [{ activeEnrollmentCount: { $lt: targetBatch.capacity } }, { activeEnrollmentCount: { $exists: false } }] } : {}) },
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
      guardianPhone: input.guardianPhone ?? current.guardianPhone,
      guardianRelation: input.guardianRelation ?? current.guardianRelation,
      createdBy: input.actor.id,
    }], { session });
    await addSubjectRows({ enrollment: next, subjectIds: selectedSubjectIds, effectiveFrom: input.effectiveAt, actorId: input.actor.id, session });
    await syncPaymentProfile({ studentId: current.studentId, subjectIds: selectedSubjectIds, feeTk: input.feeTk, actorId: input.actor.id, session });
    await writeAuditLog({
      request: input.request, actor: input.actor, organizationId: current.organizationId, branchId: targetBatch.branchId,
      action: "coaching.enrollment.transferred", resourceType: "BatchEnrollment", resourceId: current._id, reason: input.reason,
      before: { batchId: String(current.batchId), status: "active" },
      after: { batchId: String(targetBatch._id), nextEnrollmentId: String(next._id), subjectIds: selectedSubjectIds, feeTk: input.feeTk }, session,
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
    await syncPaymentProfile({ studentId: enrollment.studentId, subjectIds: [], actorId: input.actor.id, session, active: false });
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
