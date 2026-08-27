import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { ACADEMIC_SUBJECT_CATALOG } from "@/lib/academic-subject-catalog";
import { createRoutineSlot, updateRoutineSlot } from "@/lib/academic-workflows";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { isSubjectWithinTeacherDomain } from "@/lib/auth/teacher-domain-rules";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { CoachingEnrollmentSubject, type ICoachingEnrollmentSubject } from "@/lib/db/models/CoachingEnrollmentSubject";
import { User } from "@/lib/db/models/User";
import { RoutineSlot, type IRoutineSlot } from "@/lib/db/models/RoutineSlot";
import { routineListQuerySchema, routineMutationSchema } from "@/lib/validations/academic.schema";
import { notifyRoutineChange } from "@/lib/push/routine-notifications";
import { endDomainRoutine } from "@/lib/routine-workflows";
import { isRoutineMutationEnabled, requiresAcademicRoutineWriteGate } from "@/lib/routine-write-gate";

type RoutineContext = {
  teachers: Map<string, string>;
  students: Map<string, { name: string; reference?: string }>;
  batches: Map<string, { name: string; code?: string }>;
  subjects: Map<string, { name: string; nameBn: string }>;
  eligibleCounts: Map<string, number>;
};

function serializeRoutine(slot: IRoutineSlot | Record<string, unknown>, context?: RoutineContext) {
  const item = slot as IRoutineSlot;
  return {
    id: String(item._id),
    organizationId: item.organizationId ? String(item.organizationId) : undefined,
    branchId: item.branchId ? String(item.branchId) : undefined,
    academicSessionId: item.academicSessionId ? String(item.academicSessionId) : undefined,
    batchId: item.batchId ? String(item.batchId) : undefined,
    subjectId: item.subjectId ? String(item.subjectId) : undefined,
    subjectName: item.subjectName,
    teacherId: String(item.teacherId),
    teacherAssignmentId: item.teacherAssignmentId ? String(item.teacherAssignmentId) : undefined,
    studentIds: (item.studentIds ?? []).map(String),
    teacher: { id: String(item.teacherId), name: context?.teachers.get(String(item.teacherId)) ?? "Teacher" },
    students: (item.studentIds ?? []).map((id) => ({ id: String(id), ...(context?.students.get(String(id)) ?? { name: "Student" }) })),
    targeting: item.batchId && item.subjectId ? "batch-subject" : "legacy-students",
    eligibleStudentCount: item.batchId && item.subjectId
      ? context?.eligibleCounts.get(`${item.batchId}:${item.subjectId}`) ?? 0
      : (item.studentIds ?? []).length,
    batch: context?.batches.get(String(item.batchId)),
    subject: item.subjectName ? { name: item.subjectName, nameBn: item.subjectName } : context?.subjects.get(String(item.subjectId)),
    weekday: item.weekday,
    startMinute: item.startMinute,
    endMinute: item.endMinute,
    room: item.room,
    effectiveFrom: item.effectiveFrom.toISOString(),
    effectiveTo: item.effectiveTo?.toISOString(),
    status: item.status,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const parsed = routineListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const query: QueryFilter<IRoutineSlot> = { status: parsed.status };

    if (parsed.organizationId) query.organizationId = parsed.organizationId;
    if (parsed.branchId) query.branchId = parsed.branchId;
    if (parsed.academicSessionId) query.academicSessionId = parsed.academicSessionId;
    if (parsed.batchId) query.batchId = parsed.batchId;
    if (parsed.subjectId) query.subjectId = parsed.subjectId;
    if (parsed.weekday !== undefined) query.weekday = parsed.weekday;

    if (actor.role === "teacher") {
      query.teacherId = actor.id;
    } else if (actor.role === "student") {
      const enrollments = await BatchEnrollment.find({ studentId: actor.id, status: "active" }).select("_id batchId").lean();
      const subjectRows = await CoachingEnrollmentSubject.find({ enrollmentId: { $in: enrollments.map((item) => item._id) }, status: "active" }).select("enrollmentId subjectId").lean();
      const enrolledSubjects = await AcademicSubject.find({ _id: { $in: subjectRows.map((item) => item.subjectId) } }).select("name nameBn").lean();
      const subjectNamesById = new Map(enrolledSubjects.map((subject) => [String(subject._id), [subject.name, subject.nameBn].filter(Boolean)]));
      const subjectsByEnrollment = new Map<string, string[]>();
      for (const row of subjectRows) {
        const key = String(row.enrollmentId);
        subjectsByEnrollment.set(key, [...(subjectsByEnrollment.get(key) ?? []), String(row.subjectId)]);
      }
      query.$or = [
        ...enrollments.map((enrollment) => {
          const subjectIds = subjectsByEnrollment.get(String(enrollment._id)) ?? [];
          const subjectNames = subjectIds.flatMap((subjectId) => subjectNamesById.get(subjectId) ?? []);
          return { batchId: enrollment.batchId, $or: [{ subjectId: { $in: subjectIds } }, { subjectName: { $in: subjectNames } }] };
        }),
        { studentIds: actor.id },
      ];
    } else if (parsed.teacherId) {
      query.teacherId = parsed.teacherId;
    }

    const routines = await RoutineSlot.find(query)
      .sort({ weekday: 1, startMinute: 1 })
      .limit(parsed.limit)
      .lean();
    const teacherIds = routines.map((item) => item.teacherId);
    const studentIds = routines.flatMap((item) => item.studentIds ?? []);
    const [teachers, students, batches, subjects, eligibleRows] = await Promise.all([
      User.find({ _id: { $in: teacherIds } }).select("name").lean(),
      User.find({ _id: { $in: studentIds } }).select("name reference").lean(),
      Batch.find({ _id: { $in: routines.map((item) => item.batchId).filter((id): id is NonNullable<typeof id> => Boolean(id)) } }).select("name code").lean(),
      AcademicSubject.find({ _id: { $in: routines.map((item) => item.subjectId).filter((id): id is NonNullable<typeof id> => Boolean(id)) } }).select("name nameBn").lean(),
      CoachingEnrollmentSubject.find({
        status: "active",
        batchId: { $in: routines.map((item) => item.batchId).filter(Boolean) },
        subjectId: { $in: routines.map((item) => item.subjectId).filter(Boolean) },
      } as QueryFilter<ICoachingEnrollmentSubject>).select("batchId subjectId studentId").lean(),
    ]);
    const eligibleSets = new Map<string, Set<string>>();
    for (const row of eligibleRows) {
      const key = `${row.batchId}:${row.subjectId}`;
      if (!eligibleSets.has(key)) eligibleSets.set(key, new Set());
      eligibleSets.get(key)!.add(String(row.studentId));
    }
    const context: RoutineContext = {
      teachers: new Map(teachers.map((item) => [String(item._id), item.name])),
      students: new Map(students.map((item) => [String(item._id), { name: item.name, reference: item.reference }])),
      batches: new Map(batches.map((item) => [String(item._id), { name: item.name, code: item.code }])),
      subjects: new Map(subjects.map((item) => [String(item._id), { name: item.name, nameBn: item.nameBn }])),
      eligibleCounts: new Map([...eligibleSets].map(([key, ids]) => [key, ids.size])),
    };
    let options;
    if (actor.role === "admin") {
      const [optionBatches, optionTeachers, optionSubjects] = await Promise.all([
        Batch.find({ status: { $in: ["planned", "active"] } }).select("name").sort({ name: 1 }).lean(),
        User.find({
          role: "teacher",
          isAbspMember: true,
          isActive: true,
          approvalStatus: "approved",
        }).select("name teacherDomain").sort({ name: 1 }).lean(),
        AcademicSubject.find({ status: { $ne: "archived" } }).select("name nameBn").sort({ name: 1 }).lean(),
      ]);
      options = {
        batches: optionBatches.map((item) => ({ id: String(item._id), name: item.name })),
        teachers: optionTeachers.map((teacher) => {
          const canonical = optionSubjects
            .filter((subject) =>
              isSubjectWithinTeacherDomain(teacher.teacherDomain, subject.name) ||
              isSubjectWithinTeacherDomain(teacher.teacherDomain, subject.nameBn),
            )
            .map((subject) => ({
              key: String(subject._id),
              id: String(subject._id),
              name: subject.name,
              nameBn: subject.nameBn,
            }));
          const domainOnly = (teacher.teacherDomain?.subjects ?? [])
            .filter((domainSubject) => !canonical.some((subject) =>
              isSubjectWithinTeacherDomain({ isAll: false, classes: [], subjects: [domainSubject] }, subject.name) ||
              isSubjectWithinTeacherDomain({ isAll: false, classes: [], subjects: [domainSubject] }, subject.nameBn),
            ))
            .map((domainSubject) => ({
              key: `domain:${domainSubject}`,
              name: domainSubject,
              nameBn: domainSubject,
            }));
          const catalogOnly = (teacher.teacherDomain?.isAll ? ACADEMIC_SUBJECT_CATALOG : [])
            .filter((catalogSubject) => !canonical.some((subject) =>
              isSubjectWithinTeacherDomain({ isAll: false, classes: [], subjects: [catalogSubject.name] }, subject.name) ||
              isSubjectWithinTeacherDomain({ isAll: false, classes: [], subjects: [catalogSubject.name] }, subject.nameBn),
            ))
            .map((catalogSubject) => ({
              key: `domain:${catalogSubject.name}`,
              name: catalogSubject.name,
              nameBn: catalogSubject.nameBn,
            }));
          return {
            id: String(teacher._id),
            name: teacher.name,
            subjects: [...canonical, ...domainOnly, ...catalogOnly],
          };
        }),
      };
    }
    return success({ routines: routines.map((item) => serializeRoutine(item, context)), options });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    const parsed = routineMutationSchema.parse(await request.json());
    if (requiresAcademicRoutineWriteGate(parsed) && !isRoutineMutationEnabled(parsed, {
      academicWrites: process.env.ACADEMIC_WRITES_ENABLED,
      routinePublishing: process.env.ROUTINE_PUBLISHING_ENABLED,
    })) {
      throw new ApiRouteError("This routine action is not enabled on this deployment.", 503);
    }
    const previous = parsed.action === "create" ? null : await RoutineSlot.findById(parsed.routineSlotId).select("teacherId studentIds").lean();
    const routine = parsed.action === "create"
      ? await createRoutineSlot({ request, actor, batchId: parsed.batchId, teacherId: parsed.teacherId, subjectId: parsed.subjectId, subjectName: parsed.subjectName, weekday: parsed.weekday, startMinute: parsed.startMinute, endMinute: parsed.endMinute, room: parsed.room, effectiveFrom: parsed.effectiveFrom ?? new Date(), effectiveTo: parsed.effectiveTo, reason: parsed.reason })
      : parsed.action === "update"
        ? await updateRoutineSlot({ request, actor, routineSlotId: parsed.routineSlotId, batchId: parsed.batchId, teacherId: parsed.teacherId, subjectId: parsed.subjectId, subjectName: parsed.subjectName, weekday: parsed.weekday, startMinute: parsed.startMinute, endMinute: parsed.endMinute, room: parsed.room, effectiveFrom: parsed.effectiveFrom ?? new Date(), effectiveTo: parsed.effectiveTo, reason: parsed.reason })
        : await endDomainRoutine({ request, actor, routineSlotId: parsed.routineSlotId, reason: parsed.reason });
    const additionalUserIds = previous ? [String(previous.teacherId), ...(previous.studentIds ?? []).map(String)] : [];
    try {
      await notifyRoutineChange(routine, parsed.action === "end" ? "cancelled" : parsed.action === "update" ? "updated" : "created", additionalUserIds);
    } catch (notificationError) {
      console.error("Routine change notification failed:", notificationError);
    }

    return success(
      { routine: serializeRoutine(routine) },
      parsed.action === "create" ? { status: 201 } : undefined,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
