import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { success, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import {
  BatchEnrollment,
  type IBatchEnrollment,
} from "@/lib/db/models/BatchEnrollment";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { User } from "@/lib/db/models/User";
import { enrollmentListQuerySchema } from "@/lib/validations/academic.schema";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher", "student"]);
    const parsed = enrollmentListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const query: QueryFilter<IBatchEnrollment> = { status: parsed.status };

    if (parsed.organizationId) query.organizationId = parsed.organizationId;
    if (parsed.branchId) query.branchId = parsed.branchId;
    if (parsed.academicSessionId) query.academicSessionId = parsed.academicSessionId;
    if (parsed.batchId) query.batchId = parsed.batchId;

    if (user.role === "teacher") {
      const now = new Date();
      const assignments = await TeacherAssignment.find({
        teacherId: user.id,
        status: "active",
        effectiveFrom: { $lte: now },
        $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
      })
        .select("batchId")
        .lean();
      const assignedBatchIds = assignments.map((item) => String(item.batchId));
      query.batchId = {
        $in:
          parsed.batchId && assignedBatchIds.includes(parsed.batchId)
            ? [parsed.batchId]
            : parsed.batchId
              ? []
              : assignedBatchIds,
      };
    } else if (user.role === "student") {
      query.studentId = user.id;
    } else if (parsed.studentId) {
      query.studentId = parsed.studentId;
    }

    const enrollments = await BatchEnrollment.find(query)
      .sort({ effectiveFrom: -1 })
      .limit(parsed.limit)
      .lean();
    const studentIds = [...new Set(enrollments.map((item) => String(item.studentId)))];
    const students = await User.find({ _id: { $in: studentIds } })
      .select("name studentClass")
      .lean();
    const studentById = new Map(students.map((student) => [String(student._id), student]));

    return success({
      enrollments: enrollments.map((enrollment) => {
        const student = studentById.get(String(enrollment.studentId));
        return {
          id: String(enrollment._id),
          organizationId: String(enrollment.organizationId),
          branchId: String(enrollment.branchId),
          academicSessionId: String(enrollment.academicSessionId),
          batchId: String(enrollment.batchId),
          student: {
            id: String(enrollment.studentId),
            name: student?.name ?? "Unknown student",
            studentClass: student?.studentClass,
          },
          status: enrollment.status,
          effectiveFrom: enrollment.effectiveFrom.toISOString(),
          effectiveTo: enrollment.effectiveTo?.toISOString(),
          endReason: enrollment.endReason,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
