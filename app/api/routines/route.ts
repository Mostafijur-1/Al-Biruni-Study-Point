import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { createRoutineSlot, endRoutineSlot } from "@/lib/academic-workflows";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { RoutineSlot, type IRoutineSlot } from "@/lib/db/models/RoutineSlot";
import { routineListQuerySchema, routineMutationSchema } from "@/lib/validations/academic.schema";

function serializeRoutine(slot: IRoutineSlot | Record<string, unknown>) {
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
      const now = new Date();
      const enrollments = await BatchEnrollment.find({
        studentId: actor.id,
        status: "active",
        effectiveFrom: { $lte: now },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: now } },
        ],
      })
        .select("batchId")
        .lean();
      const batchIds = enrollments.map((item) => String(item.batchId));
      query.batchId = {
        $in: parsed.batchId
          ? batchIds.includes(parsed.batchId)
            ? [parsed.batchId]
            : []
          : batchIds,
      };
    } else if (parsed.teacherId) {
      query.teacherId = parsed.teacherId;
    }

    const routines = await RoutineSlot.find(query)
      .sort({ weekday: 1, startMinute: 1 })
      .limit(parsed.limit)
      .lean();
    return success({ routines: routines.map(serializeRoutine) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher"]);
    if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) {
      throw new ApiRouteError("Academic write workflows are not enabled.", 503);
    }
    const parsed = routineMutationSchema.parse(await request.json());
    const routine = parsed.action === "create"
      ? await createRoutineSlot({ request, actor, ...parsed })
      : await endRoutineSlot({
          request,
          actor,
          routineSlotId: parsed.routineSlotId,
          effectiveAt: parsed.effectiveAt ?? new Date(),
          reason: parsed.reason,
        });

    return success(
      { routine: serializeRoutine(routine) },
      parsed.action === "create" ? { status: 201 } : undefined,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
