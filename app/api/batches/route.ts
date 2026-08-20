import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { createBatch, updateBatch } from "@/lib/academic-workflows";
import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { resolveAcademicBatchReadScope } from "@/lib/academic-scope";
import { requireAuth } from "@/lib/auth/session";
import { Batch, type IBatch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { AcademicSession } from "@/lib/db/models/AcademicSession";
import { Branch } from "@/lib/db/models/Branch";
import { Organization } from "@/lib/db/models/Organization";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { batchCreateSchema, batchListQuerySchema, batchUpdateSchema } from "@/lib/validations/academic.schema";

function serializeBatch(batch: {
  _id: unknown;
  organizationId: unknown;
  branchId: unknown;
  academicSessionId: unknown;
  code: string;
  name: string;
  studentClass: string;
  capacity: number;
  activeEnrollmentCount: number;
  startsAt: Date;
  endsAt: Date;
  status: string;
}) {
  return {
    id: String(batch._id),
    organizationId: String(batch.organizationId),
    branchId: String(batch.branchId),
    academicSessionId: String(batch.academicSessionId),
    code: batch.code,
    name: batch.name,
    studentClass: batch.studentClass,
    capacity: batch.capacity,
    activeEnrollmentCount: batch.activeEnrollmentCount,
    startsAt: batch.startsAt.toISOString(),
    endsAt: batch.endsAt.toISOString(),
    status: batch.status,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher", "student"]);
    const parsed = batchListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const now = new Date();

    const [teacherAssignments, studentEnrollments] = await Promise.all([
      user.role === "teacher"
        ? TeacherAssignment.find({
            teacherId: user.id,
            status: "active",
            effectiveFrom: { $lte: now },
            $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
          })
            .select("batchId")
            .lean()
        : [],
      user.role === "student"
        ? BatchEnrollment.find({
            studentId: user.id,
            status: "active",
            effectiveFrom: { $lte: now },
            $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
          })
            .select("batchId")
            .lean()
        : [],
    ]);

    const scope = resolveAcademicBatchReadScope(
      user.role,
      teacherAssignments.map((item) => String(item.batchId)),
      studentEnrollments.map((item) => String(item.batchId)),
    );
    const query: QueryFilter<IBatch> = parsed.status === "all" ? {} : { status: parsed.status };

    if (parsed.organizationId) query.organizationId = parsed.organizationId;
    if (parsed.branchId) query.branchId = parsed.branchId;
    if (parsed.academicSessionId) query.academicSessionId = parsed.academicSessionId;
    if (parsed.studentClass) query.studentClass = parsed.studentClass;
    if (scope.kind === "assigned") query._id = { $in: scope.batchIds };

    const batches = await Batch.find(query)
      .sort({ startsAt: -1, name: 1 })
      .limit(parsed.limit)
      .lean();

    const includeContext = user.role === "admin" && request.nextUrl.searchParams.get("includeContext") === "true";
    const [organizations, branches, academicSessions] = includeContext ? await Promise.all([
      Organization.find({ status: "active" }).select("name slug").sort({ name: 1 }).lean(),
      Branch.find({ status: "active" }).select("organizationId name code").sort({ name: 1 }).lean(),
      AcademicSession.find({ status: { $in: ["planned", "active"] } }).select("organizationId name startsAt endsAt status").sort({ startsAt: -1 }).lean(),
    ]) : [[], [], []];
    return success({
      batches: batches.map(serializeBatch),
      context: includeContext ? {
        organizations: organizations.map((item) => ({ id: String(item._id), name: item.name, slug: item.slug })),
        branches: branches.map((item) => ({ id: String(item._id), organizationId: String(item.organizationId), name: item.name, code: item.code })),
        academicSessions: academicSessions.map((item) => ({ id: String(item._id), organizationId: String(item.organizationId), name: item.name, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(), status: item.status })),
      } : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) throw new ApiRouteError("Academic write workflows are not enabled.", 503);
    const parsed = batchUpdateSchema.parse(await request.json());
    const batch = await updateBatch({ request, actor, ...parsed });
    return success({ batch: serializeBatch(batch) });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) {
      throw new ApiRouteError("Academic write workflows are not enabled.", 503);
    }
    const parsed = batchCreateSchema.parse(await request.json());
    const batch = await createBatch({ request, actor, ...parsed });

    return success({ batch: serializeBatch(batch) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
