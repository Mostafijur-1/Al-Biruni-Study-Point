import mongoose, { type ClientSession, type QueryFilter, type Types } from "mongoose";
import type { NextRequest } from "next/server";

import {
  canTransitionClassSession,
  getZonedSchedulePosition,
  isEffectiveOn,
  isValidRoutineWindow,
  type ClassSessionStatus,
} from "./academic-rules.ts";
import { ApiRouteError } from "./api-error.ts";
import { writeAuditLog } from "./audit/write-audit-log.ts";
import { AcademicSession } from "./db/models/AcademicSession.ts";
import { AcademicSubject } from "./db/models/AcademicSubject.ts";
import { Batch, type IBatch } from "./db/models/Batch.ts";
import { BatchEnrollment } from "./db/models/BatchEnrollment.ts";
import { Branch } from "./db/models/Branch.ts";
import { ClassSession } from "./db/models/ClassSession.ts";
import { Organization } from "./db/models/Organization.ts";
import { RoutineSlot } from "./db/models/RoutineSlot.ts";
import { TeacherAssignment } from "./db/models/TeacherAssignment.ts";
import { User } from "./db/models/User.ts";
import type { SessionUser } from "../types/index.ts";

type WorkflowAuditContext = {
  request: NextRequest;
  actor: SessionUser;
  reason: string;
};

type CreateBatchInput = WorkflowAuditContext & {
  organizationId: string;
  branchId: string;
  academicSessionId: string;
  code: string;
  name: string;
  studentClass: "class-9" | "class-10" | "class-11" | "class-12";
  capacity: number;
  startsAt: Date;
  endsAt: Date;
};

type EnrollStudentInput = WorkflowAuditContext & {
  batchId: string;
  studentId: string;
  effectiveFrom: Date;
};

type TransferStudentInput = WorkflowAuditContext & {
  enrollmentId: string;
  targetBatchId: string;
  effectiveAt: Date;
};

type AssignTeacherInput = WorkflowAuditContext & {
  batchId: string;
  teacherId: string;
  subjectId: string;
  effectiveFrom: Date;
};

type EndTeacherAssignmentInput = WorkflowAuditContext & {
  assignmentId: string;
  effectiveAt: Date;
};

type CreateRoutineSlotInput = WorkflowAuditContext & {
  assignmentId: string;
  studentIds: string[];
  weekday: number;
  startMinute: number;
  endMinute: number;
  room?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
};

type EndRoutineSlotInput = WorkflowAuditContext & {
  routineSlotId: string;
  effectiveAt: Date;
};

type UpdateRoutineSlotInput = CreateRoutineSlotInput & { routineSlotId: string };

type CreateClassSessionInput = WorkflowAuditContext & {
  assignmentId: string;
  routineSlotId?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
};

type TransitionClassSessionInput = WorkflowAuditContext & {
  classSessionId: string;
  nextStatus: Extract<ClassSessionStatus, "completed" | "cancelled">;
};

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
    throw new ApiRouteError("Academic workflow did not complete.", 500, "INTERNAL_ERROR");
  }
  return result;
}

async function loadWritableBatch(batchId: string, session: ClientSession) {
  const batch = await Batch.findOne({
    _id: batchId,
    status: { $in: ["planned", "active"] },
  }).session(session);

  if (!batch) throw new ApiRouteError("Batch not found or not open for changes.", 404);

  const [organization, branch, academicSession] = await Promise.all([
    Organization.findOne({ _id: batch.organizationId, status: "active" }).session(session),
    Branch.findOne({
      _id: batch.branchId,
      organizationId: batch.organizationId,
      status: "active",
    }).session(session),
    AcademicSession.findOne({
      _id: batch.academicSessionId,
      organizationId: batch.organizationId,
      status: { $in: ["planned", "active"] },
    }).session(session),
  ]);

  if (!organization || !branch || !academicSession) {
    throw new ApiRouteError("Batch academic context is inactive or inconsistent.", 409);
  }
  if (batch.startsAt < academicSession.startsAt || batch.endsAt > academicSession.endsAt) {
    throw new ApiRouteError("Batch dates fall outside its academic session.", 409);
  }

  return batch;
}

async function reserveBatchSeat(
  batchId: string | Types.ObjectId,
  capacity: number,
  session: ClientSession,
) {
  const filter: QueryFilter<IBatch> = {
    _id: batchId,
    status: { $in: ["planned", "active"] },
    $or: [
      { activeEnrollmentCount: { $lt: capacity } },
      { activeEnrollmentCount: { $exists: false } },
    ],
  };
  const batch = await Batch.findOneAndUpdate(
    filter,
    { $inc: { activeEnrollmentCount: 1 } },
    { new: true, session },
  );

  if (!batch) throw new ApiRouteError("Batch capacity has been reached.", 409);
  return batch;
}

async function lockBranchSchedule(branchId: Types.ObjectId, session: ClientSession) {
  const result = await Branch.updateOne(
    { _id: branchId, status: "active" },
    { $inc: { scheduleVersion: 1 } },
    { session },
  );
  if (result.matchedCount !== 1) {
    throw new ApiRouteError("Branch is not active for schedule changes.", 409);
  }
}

export async function createBatch(input: CreateBatchInput) {
  return runTransaction(async (session) => {
    const [organization, branch, academicSession] = await Promise.all([
      Organization.findOne({ _id: input.organizationId, status: "active" }).session(session),
      Branch.findOne({
        _id: input.branchId,
        organizationId: input.organizationId,
        status: "active",
      }).session(session),
      AcademicSession.findOne({
        _id: input.academicSessionId,
        organizationId: input.organizationId,
        status: { $in: ["planned", "active"] },
      }).session(session),
    ]);

    if (!organization || !branch || !academicSession) {
      throw new ApiRouteError("Academic organization, branch, or session is invalid.", 409);
    }
    if (input.startsAt < academicSession.startsAt || input.endsAt > academicSession.endsAt) {
      throw new ApiRouteError("Batch dates must fall within the academic session.", 409);
    }

    const [batch] = await Batch.create(
      [
        {
          organizationId: organization._id,
          branchId: branch._id,
          academicSessionId: academicSession._id,
          code: input.code,
          name: input.name,
          studentClass: input.studentClass,
          capacity: input.capacity,
          activeEnrollmentCount: 0,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status: "planned",
        },
      ],
      { session },
    );

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: batch.organizationId,
      branchId: batch.branchId,
      action: "academic.batch.created",
      resourceType: "Batch",
      resourceId: batch._id,
      reason: input.reason,
      after: {
        organizationId: String(batch.organizationId),
        branchId: String(batch.branchId),
        academicSessionId: String(batch.academicSessionId),
        code: batch.code,
        studentClass: batch.studentClass,
        capacity: batch.capacity,
        status: batch.status,
      },
      session,
    });

    return batch;
  });
}

export async function enrollStudent(input: EnrollStudentInput) {
  return runTransaction(async (session) => {
    const batch = await loadWritableBatch(input.batchId, session);
    const student = await User.findOne({
      _id: input.studentId,
      role: "student",
      isActive: true,
    }).session(session);

    if (!student) throw new ApiRouteError("Active student not found.", 404);
    if (student.studentClass !== batch.studentClass) {
      throw new ApiRouteError("Student class does not match the batch class.", 409);
    }
    if (input.effectiveFrom < batch.startsAt || input.effectiveFrom > batch.endsAt) {
      throw new ApiRouteError("Enrollment date must fall within the batch dates.", 409);
    }

    const existingEnrollment = await BatchEnrollment.findOne({
      organizationId: batch.organizationId,
      academicSessionId: batch.academicSessionId,
      studentId: student._id,
      status: "active",
    }).session(session);

    if (existingEnrollment) {
      throw new ApiRouteError("Student already has an active enrollment in this academic session.", 409);
    }
    await reserveBatchSeat(batch._id, batch.capacity, session);

    const [enrollment] = await BatchEnrollment.create(
      [
        {
          organizationId: batch.organizationId,
          branchId: batch.branchId,
          academicSessionId: batch.academicSessionId,
          batchId: batch._id,
          studentId: student._id,
          status: "active",
          effectiveFrom: input.effectiveFrom,
          createdBy: input.actor.id,
        },
      ],
      { session },
    );

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: batch.organizationId,
      branchId: batch.branchId,
      action: "academic.enrollment.created",
      resourceType: "BatchEnrollment",
      resourceId: enrollment._id,
      reason: input.reason,
      after: {
        batchId: String(batch._id),
        studentId: String(student._id),
        status: enrollment.status,
        effectiveFrom: enrollment.effectiveFrom.toISOString(),
      },
      session,
    });

    return enrollment;
  });
}

export async function transferStudent(input: TransferStudentInput) {
  return runTransaction(async (session) => {
    const current = await BatchEnrollment.findOne({
      _id: input.enrollmentId,
      status: "active",
    }).session(session);
    if (!current) throw new ApiRouteError("Active enrollment not found.", 404);
    if (String(current.batchId) === input.targetBatchId) {
      throw new ApiRouteError("Student is already enrolled in the target batch.", 409);
    }
    if (input.effectiveAt < current.effectiveFrom) {
      throw new ApiRouteError("Transfer date cannot precede the current enrollment.", 409);
    }

    const [targetBatch, currentBatch] = await Promise.all([
      loadWritableBatch(input.targetBatchId, session),
      Batch.findById(current.batchId).session(session),
    ]);
    if (!currentBatch) throw new ApiRouteError("Current batch not found.", 409);
    if (
      String(targetBatch.organizationId) !== String(current.organizationId) ||
      String(targetBatch.academicSessionId) !== String(current.academicSessionId) ||
      targetBatch.studentClass !== currentBatch.studentClass
    ) {
      throw new ApiRouteError("Transfer target must use the same organization, session, and class.", 409);
    }
    if (input.effectiveAt < targetBatch.startsAt || input.effectiveAt > targetBatch.endsAt) {
      throw new ApiRouteError("Transfer date must fall within the target batch dates.", 409);
    }

    await reserveBatchSeat(targetBatch._id, targetBatch.capacity, session);

    current.status = "transferred";
    current.effectiveTo = input.effectiveAt;
    current.endReason = input.reason;
    await current.save({ session });
    await Batch.updateOne(
      { _id: current.batchId, activeEnrollmentCount: { $gt: 0 } },
      { $inc: { activeEnrollmentCount: -1 } },
      { session },
    );

    const [nextEnrollment] = await BatchEnrollment.create(
      [
        {
          organizationId: targetBatch.organizationId,
          branchId: targetBatch.branchId,
          academicSessionId: targetBatch.academicSessionId,
          batchId: targetBatch._id,
          studentId: current.studentId,
          status: "active",
          effectiveFrom: input.effectiveAt,
          createdBy: input.actor.id,
        },
      ],
      { session },
    );

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: current.organizationId,
      branchId: targetBatch.branchId,
      action: "academic.enrollment.transferred",
      resourceType: "BatchEnrollment",
      resourceId: current._id,
      reason: input.reason,
      before: { batchId: String(current.batchId), status: "active" },
      after: {
        batchId: String(targetBatch._id),
        status: nextEnrollment.status,
        nextEnrollmentId: String(nextEnrollment._id),
        effectiveFrom: nextEnrollment.effectiveFrom.toISOString(),
      },
      session,
    });

    return nextEnrollment;
  });
}

export async function assignTeacher(input: AssignTeacherInput) {
  return runTransaction(async (session) => {
    const batch = await loadWritableBatch(input.batchId, session);
    const [teacher, subject] = await Promise.all([
      User.findOne({
        _id: input.teacherId,
        role: "teacher",
        isActive: true,
        approvalStatus: "approved",
      }).session(session),
      AcademicSubject.findOne({
        _id: input.subjectId,
        organizationId: batch.organizationId,
        status: "active",
        classLevels: batch.studentClass,
      }).session(session),
    ]);

    if (!teacher) throw new ApiRouteError("Approved active teacher not found.", 404);
    if (!subject) throw new ApiRouteError("Subject is not active for this batch class.", 409);
    if (input.effectiveFrom < batch.startsAt || input.effectiveFrom > batch.endsAt) {
      throw new ApiRouteError("Assignment date must fall within the batch dates.", 409);
    }

    const existing = await TeacherAssignment.findOne({
      batchId: batch._id,
      teacherId: teacher._id,
      subjectId: subject._id,
      status: "active",
    }).session(session);
    if (existing) throw new ApiRouteError("Teacher already has this active assignment.", 409);

    const [assignment] = await TeacherAssignment.create(
      [
        {
          organizationId: batch.organizationId,
          branchId: batch.branchId,
          academicSessionId: batch.academicSessionId,
          batchId: batch._id,
          teacherId: teacher._id,
          subjectId: subject._id,
          status: "active",
          effectiveFrom: input.effectiveFrom,
          createdBy: input.actor.id,
        },
      ],
      { session },
    );

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: batch.organizationId,
      branchId: batch.branchId,
      action: "academic.teacher-assignment.created",
      resourceType: "TeacherAssignment",
      resourceId: assignment._id,
      reason: input.reason,
      after: {
        batchId: String(batch._id),
        teacherId: String(teacher._id),
        subjectId: String(subject._id),
        effectiveFrom: assignment.effectiveFrom.toISOString(),
      },
      session,
    });

    return assignment;
  });
}

export async function endTeacherAssignment(input: EndTeacherAssignmentInput) {
  return runTransaction(async (session) => {
    const assignment = await TeacherAssignment.findOne({
      _id: input.assignmentId,
      status: "active",
    }).session(session);
    if (!assignment) throw new ApiRouteError("Active teacher assignment not found.", 404);
    if (input.effectiveAt < assignment.effectiveFrom) {
      throw new ApiRouteError("Assignment end date cannot precede its start date.", 409);
    }
    const activeRoutine = await RoutineSlot.exists({
      teacherAssignmentId: assignment._id,
      status: "active",
    }).session(session);
    if (activeRoutine) {
      throw new ApiRouteError("End active routine slots before ending this assignment.", 409);
    }

    assignment.status = "ended";
    assignment.effectiveTo = input.effectiveAt;
    assignment.endReason = input.reason;
    await assignment.save({ session });

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: assignment.organizationId,
      branchId: assignment.branchId,
      action: "academic.teacher-assignment.ended",
      resourceType: "TeacherAssignment",
      resourceId: assignment._id,
      reason: input.reason,
      before: { status: "active", effectiveTo: null },
      after: { status: assignment.status, effectiveTo: assignment.effectiveTo.toISOString() },
      session,
    });

    return assignment;
  });
}

export async function createRoutineSlot(input: CreateRoutineSlotInput) {
  return runTransaction(async (session) => {
    if (!isValidRoutineWindow(input.startMinute, input.endMinute)) {
      throw new ApiRouteError("Routine time window is invalid.", 400, "VALIDATION_ERROR");
    }
    const assignment = await TeacherAssignment.findOne({
      _id: input.assignmentId,
      status: "active",
    }).session(session);
    if (!assignment) throw new ApiRouteError("Active teacher assignment not found.", 404);
    if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can manage routines.", 403);

    const studentIds = [...new Set(input.studentIds)];
    const students = await User.find({
      _id: { $in: studentIds },
      role: "student",
      isActive: true,
      approvalStatus: "approved",
    }).select("_id").session(session).lean();
    if (students.length !== studentIds.length) {
      throw new ApiRouteError("One or more selected students are unavailable.", 409);
    }
    const batch = await loadWritableBatch(String(assignment.batchId), session);
    const maximumEffectiveTo = assignment.effectiveTo && assignment.effectiveTo < batch.endsAt
      ? assignment.effectiveTo
      : batch.endsAt;
    const effectiveTo = input.effectiveTo ?? maximumEffectiveTo;
    if (
      !isEffectiveOn(assignment.effectiveFrom, assignment.effectiveTo, input.effectiveFrom) ||
      input.effectiveFrom < batch.startsAt ||
      effectiveTo > maximumEffectiveTo ||
      input.effectiveFrom > effectiveTo
    ) {
      throw new ApiRouteError("Routine dates fall outside the assignment or batch.", 409);
    }

    await lockBranchSchedule(batch.branchId, session);
    const conflict = await RoutineSlot.findOne({
      branchId: batch.branchId,
      status: "active",
      weekday: input.weekday,
      startMinute: { $lt: input.endMinute },
      endMinute: { $gt: input.startMinute },
      effectiveFrom: { $lte: effectiveTo },
      $or: [
        { effectiveTo: { $exists: false } },
        { effectiveTo: null },
        { effectiveTo: { $gte: input.effectiveFrom } },
      ],
    }).session(session);
    if (conflict) throw new ApiRouteError("Routine conflicts with an existing slot.", 409);

    const [routineSlot] = await RoutineSlot.create(
      [
        {
          organizationId: batch.organizationId,
          branchId: batch.branchId,
          academicSessionId: batch.academicSessionId,
          batchId: assignment.batchId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          teacherAssignmentId: assignment._id,
          studentIds,
          weekday: input.weekday,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
          room: input.room?.trim() || undefined,
          effectiveFrom: input.effectiveFrom,
          effectiveTo,
          status: "active",
          createdBy: input.actor.id,
        },
      ],
      { session },
    );

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: batch.organizationId,
      branchId: batch.branchId,
      action: "academic.routine-slot.created",
      resourceType: "RoutineSlot",
      resourceId: routineSlot._id,
      reason: input.reason,
      after: {
        assignmentId: String(assignment._id),
        batchId: String(assignment.batchId),
        studentIds,
        weekday: routineSlot.weekday,
        startMinute: routineSlot.startMinute,
        endMinute: routineSlot.endMinute,
        effectiveFrom: routineSlot.effectiveFrom.toISOString(),
        effectiveTo: routineSlot.effectiveTo?.toISOString(),
      },
      session,
    });

    return routineSlot;
  });
}

export async function updateRoutineSlot(input: UpdateRoutineSlotInput) {
  return runTransaction(async (session) => {
    if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can manage routines.", 403);
    if (!isValidRoutineWindow(input.startMinute, input.endMinute)) {
      throw new ApiRouteError("Routine time window is invalid.", 400, "VALIDATION_ERROR");
    }
    const [routineSlot, assignment] = await Promise.all([
      RoutineSlot.findOne({ _id: input.routineSlotId, status: "active" }).session(session),
      TeacherAssignment.findOne({ _id: input.assignmentId, status: "active" }).session(session),
    ]);
    if (!routineSlot) throw new ApiRouteError("Active routine slot not found.", 404);
    if (!assignment) throw new ApiRouteError("Active teacher assignment not found.", 404);
    const linkedSession = await ClassSession.exists({ routineSlotId: routineSlot._id, status: "scheduled" }).session(session);
    if (linkedSession) throw new ApiRouteError("This legacy routine has a scheduled class session and cannot be edited.", 409);

    const batch = await loadWritableBatch(String(assignment.batchId), session);
    const maximumEffectiveTo = assignment.effectiveTo && assignment.effectiveTo < batch.endsAt ? assignment.effectiveTo : batch.endsAt;
    const effectiveTo = input.effectiveTo ?? maximumEffectiveTo;
    if (!isEffectiveOn(assignment.effectiveFrom, assignment.effectiveTo, input.effectiveFrom) || input.effectiveFrom < batch.startsAt || effectiveTo > maximumEffectiveTo || input.effectiveFrom > effectiveTo) {
      throw new ApiRouteError("Routine dates fall outside the assignment or batch.", 409);
    }
    const studentIds = [...new Set(input.studentIds)];
    const students = await User.find({ _id: { $in: studentIds }, role: "student", isActive: true, approvalStatus: "approved" }).select("_id").session(session).lean();
    if (students.length !== studentIds.length) {
      throw new ApiRouteError("Every selected student must be active and approved.", 409);
    }
    await lockBranchSchedule(batch.branchId, session);
    const conflict = await RoutineSlot.findOne({
      _id: { $ne: routineSlot._id }, branchId: batch.branchId, status: "active", weekday: input.weekday,
      startMinute: { $lt: input.endMinute }, endMinute: { $gt: input.startMinute }, effectiveFrom: { $lte: effectiveTo },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: input.effectiveFrom } }],
    }).session(session);
    if (conflict) throw new ApiRouteError("Routine conflicts with an existing slot.", 409);

    const before = { teacherId: String(routineSlot.teacherId), studentIds: (routineSlot.studentIds ?? []).map(String), weekday: routineSlot.weekday, startMinute: routineSlot.startMinute, endMinute: routineSlot.endMinute };
    routineSlot.set({
      organizationId: batch.organizationId, branchId: batch.branchId, academicSessionId: batch.academicSessionId,
      batchId: assignment.batchId, subjectId: assignment.subjectId, teacherId: assignment.teacherId, teacherAssignmentId: assignment._id,
      studentIds, weekday: input.weekday, startMinute: input.startMinute, endMinute: input.endMinute,
      room: input.room?.trim() || undefined, effectiveFrom: input.effectiveFrom, effectiveTo,
    });
    await routineSlot.save({ session });
    await writeAuditLog({ request: input.request, actor: input.actor, organizationId: batch.organizationId, branchId: batch.branchId, action: "academic.routine-slot.updated", resourceType: "RoutineSlot", resourceId: routineSlot._id, reason: input.reason, before, after: { teacherId: String(routineSlot.teacherId), studentIds, weekday: routineSlot.weekday, startMinute: routineSlot.startMinute, endMinute: routineSlot.endMinute }, session });
    return routineSlot;
  });
}

export async function endRoutineSlot(input: EndRoutineSlotInput) {
  return runTransaction(async (session) => {
    const routineSlot = await RoutineSlot.findOne({
      _id: input.routineSlotId,
      status: "active",
    }).session(session);
    if (!routineSlot) throw new ApiRouteError("Active routine slot not found.", 404);
    if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can manage routines.", 403);
    if (input.effectiveAt < routineSlot.effectiveFrom) {
      throw new ApiRouteError("Routine end date cannot precede its start date.", 409);
    }
    if (routineSlot.effectiveTo && input.effectiveAt > routineSlot.effectiveTo) {
      throw new ApiRouteError("Routine end date cannot extend its approved window.", 409);
    }

    await lockBranchSchedule(routineSlot.branchId, session);
    const laterClassSession = await ClassSession.exists({
      routineSlotId: routineSlot._id,
      status: { $in: ["scheduled", "completed"] },
      scheduledEnd: { $gt: input.effectiveAt },
    }).session(session);
    if (laterClassSession) {
      throw new ApiRouteError(
        "Cancel or reschedule linked class sessions before ending this routine.",
        409,
      );
    }
    routineSlot.status = "ended";
    routineSlot.effectiveTo = input.effectiveAt;
    await routineSlot.save({ session });

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: routineSlot.organizationId,
      branchId: routineSlot.branchId,
      action: "academic.routine-slot.ended",
      resourceType: "RoutineSlot",
      resourceId: routineSlot._id,
      reason: input.reason,
      before: { status: "active" },
      after: { status: routineSlot.status, effectiveTo: routineSlot.effectiveTo.toISOString() },
      session,
    });

    return routineSlot;
  });
}

export async function createClassSession(input: CreateClassSessionInput) {
  return runTransaction(async (session) => {
    if (input.scheduledStart >= input.scheduledEnd) {
      throw new ApiRouteError("Class session end time must be after its start time.", 400, "VALIDATION_ERROR");
    }
    const assignment = await TeacherAssignment.findOne({
      _id: input.assignmentId,
      status: "active",
    }).session(session);
    if (!assignment) throw new ApiRouteError("Active teacher assignment not found.", 404);
    if (input.actor.role === "teacher" && String(assignment.teacherId) !== input.actor.id) {
      throw new ApiRouteError("You cannot create another teacher's class session.", 403);
    }
    const batch = await loadWritableBatch(String(assignment.batchId), session);
    if (
      input.scheduledStart < batch.startsAt ||
      input.scheduledEnd > batch.endsAt ||
      !isEffectiveOn(assignment.effectiveFrom, assignment.effectiveTo, input.scheduledStart) ||
      (assignment.effectiveTo !== undefined && input.scheduledEnd > assignment.effectiveTo)
    ) {
      throw new ApiRouteError("Class session falls outside the batch or assignment dates.", 409);
    }

    let routineSlot;
    if (input.routineSlotId) {
      routineSlot = await RoutineSlot.findOne({
        _id: input.routineSlotId,
        teacherAssignmentId: assignment._id,
        status: "active",
      }).session(session);
      if (
        !routineSlot ||
        !isEffectiveOn(routineSlot.effectiveFrom, routineSlot.effectiveTo, input.scheduledStart) ||
        (routineSlot.effectiveTo !== undefined && input.scheduledEnd > routineSlot.effectiveTo)
      ) {
        throw new ApiRouteError("Routine slot is not active for this class session.", 409);
      }
      const organization = await Organization.findById(batch.organizationId)
        .select("timezone")
        .session(session);
      if (!organization) throw new ApiRouteError("Organization timezone is unavailable.", 409);
      const localStart = getZonedSchedulePosition(input.scheduledStart, organization.timezone);
      const localEnd = getZonedSchedulePosition(input.scheduledEnd, organization.timezone);
      if (
        localStart.weekday !== routineSlot.weekday ||
        localEnd.weekday !== routineSlot.weekday ||
        localStart.minuteOfDay !== routineSlot.startMinute ||
        localEnd.minuteOfDay !== routineSlot.endMinute
      ) {
        throw new ApiRouteError("Class session time does not match its routine slot.", 409);
      }
    }

    await lockBranchSchedule(batch.branchId, session);
    const conflict = await ClassSession.findOne({
      status: { $in: ["scheduled", "completed"] },
      scheduledStart: { $lt: input.scheduledEnd },
      scheduledEnd: { $gt: input.scheduledStart },
      $or: [{ teacherId: assignment.teacherId }, { batchId: assignment.batchId }],
    }).session(session);
    if (conflict) throw new ApiRouteError("Class session conflicts with an existing session.", 409);

    const [classSession] = await ClassSession.create(
      [
        {
          organizationId: batch.organizationId,
          branchId: batch.branchId,
          academicSessionId: batch.academicSessionId,
          batchId: assignment.batchId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          routineSlotId: routineSlot?._id,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          status: "scheduled",
          createdBy: input.actor.id,
        },
      ],
      { session },
    );

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: batch.organizationId,
      branchId: batch.branchId,
      action: "academic.class-session.created",
      resourceType: "ClassSession",
      resourceId: classSession._id,
      reason: input.reason,
      after: {
        assignmentId: String(assignment._id),
        batchId: String(assignment.batchId),
        scheduledStart: classSession.scheduledStart.toISOString(),
        scheduledEnd: classSession.scheduledEnd.toISOString(),
        status: classSession.status,
      },
      session,
    });

    return classSession;
  });
}

export async function transitionClassSession(input: TransitionClassSessionInput) {
  return runTransaction(async (session) => {
    const classSession = await ClassSession.findById(input.classSessionId).session(session);
    if (!classSession) throw new ApiRouteError("Class session not found.", 404);
    if (input.actor.role === "teacher" && String(classSession.teacherId) !== input.actor.id) {
      throw new ApiRouteError("You cannot update another teacher's class session.", 403);
    }
    if (!canTransitionClassSession(classSession.status, input.nextStatus)) {
      throw new ApiRouteError("Class session is already in a terminal state.", 409);
    }

    const previousStatus = classSession.status;
    classSession.status = input.nextStatus;
    classSession.cancellationReason = input.nextStatus === "cancelled" ? input.reason : undefined;
    await classSession.save({ session });

    await writeAuditLog({
      request: input.request,
      actor: input.actor,
      organizationId: classSession.organizationId,
      branchId: classSession.branchId,
      action: `academic.class-session.${input.nextStatus}`,
      resourceType: "ClassSession",
      resourceId: classSession._id,
      reason: input.reason,
      before: { status: previousStatus },
      after: { status: classSession.status },
      session,
    });

    return classSession;
  });
}
