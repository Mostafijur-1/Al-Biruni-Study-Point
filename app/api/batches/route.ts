import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { success, handleApiError } from "@/lib/api/response";
import { resolveAcademicBatchReadScope } from "@/lib/academic-scope";
import { requireAuth } from "@/lib/auth/session";
import { Batch, type IBatch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { batchListQuerySchema } from "@/lib/validations/academic.schema";

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
    const query: QueryFilter<IBatch> = { status: parsed.status };

    if (parsed.organizationId) query.organizationId = parsed.organizationId;
    if (parsed.branchId) query.branchId = parsed.branchId;
    if (parsed.academicSessionId) query.academicSessionId = parsed.academicSessionId;
    if (parsed.studentClass) query.studentClass = parsed.studentClass;
    if (scope.kind === "assigned") query._id = { $in: scope.batchIds };

    const batches = await Batch.find(query)
      .sort({ startsAt: -1, name: 1 })
      .limit(parsed.limit)
      .lean();

    return success({
      batches: batches.map((batch) => ({
        id: String(batch._id),
        organizationId: String(batch.organizationId),
        branchId: String(batch.branchId),
        academicSessionId: String(batch.academicSessionId),
        code: batch.code,
        name: batch.name,
        studentClass: batch.studentClass,
        capacity: batch.capacity,
        startsAt: batch.startsAt.toISOString(),
        endsAt: batch.endsAt.toISOString(),
        status: batch.status,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
