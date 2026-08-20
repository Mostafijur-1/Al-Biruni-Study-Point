import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { createRoutineSlot, endRoutineSlot, updateRoutineSlot } from "@/lib/academic-workflows";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { User } from "@/lib/db/models/User";
import { RoutineSlot, type IRoutineSlot } from "@/lib/db/models/RoutineSlot";
import { routineListQuerySchema, routineMutationSchema } from "@/lib/validations/academic.schema";
import { notifyRoutineChange } from "@/lib/push/routine-notifications";

type RoutineContext = {
  teachers: Map<string, string>;
  students: Map<string, { name: string; reference?: string }>;
  batches: Map<string, { name: string; code: string }>;
  subjects: Map<string, { name: string; nameBn: string }>;
};

function serializeRoutine(slot: IRoutineSlot | Record<string, unknown>, context?: RoutineContext) {
  const item = slot as IRoutineSlot;
  return {
    id: String(item._id),
    organizationId: String(item.organizationId),
    branchId: String(item.branchId),
    academicSessionId: String(item.academicSessionId),
    batchId: String(item.batchId),
    subjectId: String(item.subjectId),
    teacherId: String(item.teacherId),
    teacherAssignmentId: String(item.teacherAssignmentId),
    studentIds: (item.studentIds ?? []).map(String),
    teacher: { id: String(item.teacherId), name: context?.teachers.get(String(item.teacherId)) ?? "Teacher" },
    students: (item.studentIds ?? []).map((id) => ({ id: String(id), ...(context?.students.get(String(id)) ?? { name: "Student" }) })),
    batch: context?.batches.get(String(item.batchId)),
    subject: context?.subjects.get(String(item.subjectId)),
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
      query.studentIds = actor.id;
    } else if (parsed.teacherId) {
      query.teacherId = parsed.teacherId;
    }

    const routines = await RoutineSlot.find(query)
      .sort({ weekday: 1, startMinute: 1 })
      .limit(parsed.limit)
      .lean();
    const teacherIds = routines.map((item) => item.teacherId);
    const studentIds = routines.flatMap((item) => item.studentIds ?? []);
    const [teachers, students, batches, subjects] = await Promise.all([
      User.find({ _id: { $in: teacherIds } }).select("name").lean(),
      User.find({ _id: { $in: studentIds } }).select("name reference").lean(),
      Batch.find({ _id: { $in: routines.map((item) => item.batchId) } }).select("name code").lean(),
      AcademicSubject.find({ _id: { $in: routines.map((item) => item.subjectId) } }).select("name nameBn").lean(),
    ]);
    const context: RoutineContext = {
      teachers: new Map(teachers.map((item) => [String(item._id), item.name])),
      students: new Map(students.map((item) => [String(item._id), { name: item.name, reference: item.reference }])),
      batches: new Map(batches.map((item) => [String(item._id), { name: item.name, code: item.code }])),
      subjects: new Map(subjects.map((item) => [String(item._id), { name: item.name, nameBn: item.nameBn }])),
    };
    return success({ routines: routines.map((item) => serializeRoutine(item, context)) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) {
      throw new ApiRouteError("Academic write workflows are not enabled.", 503);
    }
    const parsed = routineMutationSchema.parse(await request.json());
    const previous = parsed.action === "create" ? null : await RoutineSlot.findById(parsed.routineSlotId).select("teacherId studentIds").lean();
    const routine = parsed.action === "create"
      ? await createRoutineSlot({ request, actor, ...parsed })
      : parsed.action === "update"
        ? await updateRoutineSlot({ request, actor, ...parsed })
        : await endRoutineSlot({
          request,
          actor,
          routineSlotId: parsed.routineSlotId,
          effectiveAt: parsed.effectiveAt ?? new Date(),
          reason: parsed.reason,
        });
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
