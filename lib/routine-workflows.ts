import type { NextRequest } from "next/server";

import { isValidRoutineWindow } from "./academic-rules.ts";
import { ApiRouteError } from "./api-error.ts";
import { writeAuditLog } from "./audit/write-audit-log.ts";
import { isSubjectWithinTeacherDomain } from "./auth/teacher-domain-rules.ts";
import { RoutineSlot } from "./db/models/RoutineSlot.ts";
import { User } from "./db/models/User.ts";
import type { SessionUser } from "../types/index.ts";

type DirectRoutineInput = {
  request: NextRequest;
  actor: SessionUser;
  teacherId: string;
  subject: string;
  studentIds: string[];
  weekday: number;
  startMinute: number;
  endMinute: number;
  reason: string;
};

async function validateParticipants(input: DirectRoutineInput) {
  if (!isValidRoutineWindow(input.startMinute, input.endMinute)) {
    throw new ApiRouteError("Routine time window is invalid.", 400, "VALIDATION_ERROR");
  }
  const teacher = await User.findOne({
    _id: input.teacherId,
    role: "teacher",
    isAbspMember: true,
    isActive: true,
    approvalStatus: "approved",
  }).select("teacherDomain").lean();
  if (!teacher) throw new ApiRouteError("Approved ABSP teacher not found.", 404);
  if (!isSubjectWithinTeacherDomain(teacher.teacherDomain, input.subject)) {
    throw new ApiRouteError("The subject is not approved in this teacher's domain.", 403);
  }
  const studentIds = [...new Set(input.studentIds)];
  const students = await User.find({
    _id: { $in: studentIds },
    role: "student",
    isActive: true,
    approvalStatus: "approved",
  }).select("_id").lean();
  if (students.length !== studentIds.length) {
    throw new ApiRouteError("One or more selected students are unavailable.", 409);
  }
  return studentIds;
}

async function assertNoConflict(input: DirectRoutineInput, effectiveFrom: Date, excludeId?: string) {
  const conflict = await RoutineSlot.exists({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    status: "active",
    weekday: input.weekday,
    startMinute: { $lt: input.endMinute },
    endMinute: { $gt: input.startMinute },
    $or: [
      { effectiveTo: { $exists: false } },
      { effectiveTo: null },
      { effectiveTo: { $gte: effectiveFrom } },
    ],
  });
  if (conflict) throw new ApiRouteError("Another routine already uses this day and time.", 409);
}

export async function createDomainRoutine(input: DirectRoutineInput) {
  if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can manage routines.", 403);
  const studentIds = await validateParticipants(input);
  const effectiveFrom = new Date();
  await assertNoConflict(input, effectiveFrom);
  const routine = await RoutineSlot.create({
    teacherId: input.teacherId,
    subjectName: input.subject,
    studentIds,
    weekday: input.weekday,
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    effectiveFrom,
    status: "active",
    createdBy: input.actor.id,
  });
  await writeAuditLog({
    request: input.request,
    actor: input.actor,
    action: "routine.created",
    resourceType: "RoutineSlot",
    resourceId: routine._id,
    reason: input.reason,
    after: { teacherId: input.teacherId, subject: input.subject, studentIds, weekday: input.weekday, startMinute: input.startMinute, endMinute: input.endMinute },
  });
  return routine;
}

export async function updateDomainRoutine(input: DirectRoutineInput & { routineSlotId: string }) {
  if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can manage routines.", 403);
  const routine = await RoutineSlot.findOne({ _id: input.routineSlotId, status: "active" });
  if (!routine) throw new ApiRouteError("Active routine slot not found.", 404);
  const studentIds = await validateParticipants(input);
  await assertNoConflict(input, routine.effectiveFrom, input.routineSlotId);
  const before = { teacherId: String(routine.teacherId), subject: routine.subjectName, studentIds: routine.studentIds.map(String), weekday: routine.weekday, startMinute: routine.startMinute, endMinute: routine.endMinute };
  routine.set({ teacherId: input.teacherId, subjectName: input.subject, studentIds, weekday: input.weekday, startMinute: input.startMinute, endMinute: input.endMinute });
  await routine.save();
  await writeAuditLog({
    request: input.request,
    actor: input.actor,
    action: "routine.updated",
    resourceType: "RoutineSlot",
    resourceId: routine._id,
    reason: input.reason,
    before,
    after: { teacherId: input.teacherId, subject: input.subject, studentIds, weekday: input.weekday, startMinute: input.startMinute, endMinute: input.endMinute },
  });
  return routine;
}

export async function endDomainRoutine(input: { request: NextRequest; actor: SessionUser; routineSlotId: string; reason: string }) {
  if (input.actor.role !== "admin") throw new ApiRouteError("Only admins can manage routines.", 403);
  const routine = await RoutineSlot.findOne({ _id: input.routineSlotId, status: "active" });
  if (!routine) throw new ApiRouteError("Active routine slot not found.", 404);
  routine.status = "ended";
  routine.effectiveTo = new Date();
  await routine.save();
  await writeAuditLog({ request: input.request, actor: input.actor, action: "routine.ended", resourceType: "RoutineSlot", resourceId: routine._id, reason: input.reason, before: { status: "active" }, after: { status: "ended" } });
  return routine;
}
