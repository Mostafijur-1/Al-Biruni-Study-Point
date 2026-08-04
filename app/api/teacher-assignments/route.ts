import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { assignTeacher, endTeacherAssignment } from "@/lib/academic-workflows";
import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import {
  TeacherAssignment,
  type ITeacherAssignment,
} from "@/lib/db/models/TeacherAssignment";
import {
  teacherAssignmentListQuerySchema,
  teacherAssignmentMutationSchema,
} from "@/lib/validations/academic.schema";

function serializeAssignment(assignment: {
  _id: unknown;
  organizationId: unknown;
  branchId: unknown;
  academicSessionId: unknown;
  batchId: unknown;
  teacherId: unknown;
  subjectId: unknown;
  status: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  endReason?: string;
}) {
  return {
    id: String(assignment._id),
    organizationId: String(assignment.organizationId),
    branchId: String(assignment.branchId),
    academicSessionId: String(assignment.academicSessionId),
    batchId: String(assignment.batchId),
    teacherId: String(assignment.teacherId),
    subjectId: String(assignment.subjectId),
    status: assignment.status,
    effectiveFrom: assignment.effectiveFrom.toISOString(),
    effectiveTo: assignment.effectiveTo?.toISOString(),
    endReason: assignment.endReason,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher"]);
    const parsed = teacherAssignmentListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const query: QueryFilter<ITeacherAssignment> = { status: parsed.status };

    if (parsed.organizationId) query.organizationId = parsed.organizationId;
    if (parsed.branchId) query.branchId = parsed.branchId;
    if (parsed.academicSessionId) query.academicSessionId = parsed.academicSessionId;
    if (parsed.batchId) query.batchId = parsed.batchId;
    if (parsed.subjectId) query.subjectId = parsed.subjectId;
    if (actor.role === "teacher") query.teacherId = actor.id;
    else if (parsed.teacherId) query.teacherId = parsed.teacherId;

    const assignments = await TeacherAssignment.find(query)
      .sort({ effectiveFrom: -1 })
      .limit(parsed.limit)
      .lean();

    return success({ assignments: assignments.map(serializeAssignment) });
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
    const parsed = teacherAssignmentMutationSchema.parse(await request.json());

    const assignment =
      parsed.action === "assign"
        ? await assignTeacher({
            request,
            actor,
            batchId: parsed.batchId,
            teacherId: parsed.teacherId,
            subjectId: parsed.subjectId,
            effectiveFrom: parsed.effectiveFrom ?? new Date(),
            reason: parsed.reason,
          })
        : await endTeacherAssignment({
            request,
            actor,
            assignmentId: parsed.assignmentId,
            effectiveAt: parsed.effectiveAt ?? new Date(),
            reason: parsed.reason,
          });

    return success(
      { assignment: serializeAssignment(assignment) },
      parsed.action === "assign" ? { status: 201 } : undefined,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
