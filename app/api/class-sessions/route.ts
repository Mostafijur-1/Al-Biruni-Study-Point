import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { createClassSession, transitionClassSession } from "@/lib/academic-workflows";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { ClassSession, type IClassSession } from "@/lib/db/models/ClassSession";
import {
  classSessionListQuerySchema,
  classSessionMutationSchema,
} from "@/lib/validations/academic.schema";

function serializeClassSession(value: IClassSession | Record<string, unknown>) {
  const item = value as IClassSession;
  return {
    id: String(item._id),
    organizationId: String(item.organizationId),
    branchId: String(item.branchId),
    academicSessionId: String(item.academicSessionId),
    batchId: String(item.batchId),
    subjectId: String(item.subjectId),
    teacherId: String(item.teacherId),
    routineSlotId: item.routineSlotId ? String(item.routineSlotId) : undefined,
    scheduledStart: item.scheduledStart.toISOString(),
    scheduledEnd: item.scheduledEnd.toISOString(),
    status: item.status,
    cancellationReason: item.cancellationReason,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const parsed = classSessionListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const query: QueryFilter<IClassSession> = { status: parsed.status };

    if (parsed.organizationId) query.organizationId = parsed.organizationId;
    if (parsed.branchId) query.branchId = parsed.branchId;
    if (parsed.academicSessionId) query.academicSessionId = parsed.academicSessionId;
    if (parsed.batchId) query.batchId = parsed.batchId;
    if (parsed.subjectId) query.subjectId = parsed.subjectId;
    if (parsed.from || parsed.to) {
      query.scheduledStart = {
        ...(parsed.from ? { $gte: parsed.from } : {}),
        ...(parsed.to ? { $lte: parsed.to } : {}),
      };
    }

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

    const classSessions = await ClassSession.find(query)
      .sort({ scheduledStart: 1 })
      .limit(parsed.limit)
      .lean();
    return success({ classSessions: classSessions.map(serializeClassSession) });
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
    const parsed = classSessionMutationSchema.parse(await request.json());
    const classSession = parsed.action === "create"
      ? await createClassSession({ request, actor, ...parsed })
      : await transitionClassSession({
          request,
          actor,
          classSessionId: parsed.classSessionId,
          nextStatus: parsed.action === "complete" ? "completed" : "cancelled",
          reason: parsed.reason,
        });

    return success(
      { classSession: serializeClassSession(classSession) },
      parsed.action === "create" ? { status: 201 } : undefined,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
