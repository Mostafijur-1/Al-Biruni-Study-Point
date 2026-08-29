import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { createCoachingEnrollment, transferCoachingEnrollment, updateCoachingSubjects, withdrawCoachingEnrollment } from "@/lib/coaching-enrollment-service";
import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { ApiRouteError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth/session";
import {
  BatchEnrollment,
  type IBatchEnrollment,
} from "@/lib/db/models/BatchEnrollment";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { User } from "@/lib/db/models/User";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { CoachingEnrollmentSubject } from "@/lib/db/models/CoachingEnrollmentSubject";
import { PaymentProfile } from "@/lib/db/models/PaymentProfile";
import {
  enrollmentListQuerySchema,
  enrollmentMutationSchema,
} from "@/lib/validations/academic.schema";

function serializeEnrollment(enrollment: {
  _id: unknown;
  organizationId?: unknown;
  branchId?: unknown;
  academicSessionId?: unknown;
  batchId: unknown;
  studentId: unknown;
  status: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  endReason?: string;
}) {
  return {
    id: String(enrollment._id),
    organizationId: enrollment.organizationId ? String(enrollment.organizationId) : undefined,
    branchId: enrollment.branchId ? String(enrollment.branchId) : undefined,
    academicSessionId: enrollment.academicSessionId ? String(enrollment.academicSessionId) : undefined,
    batchId: String(enrollment.batchId),
    studentId: String(enrollment.studentId),
    status: enrollment.status,
    effectiveFrom: enrollment.effectiveFrom.toISOString(),
    effectiveTo: enrollment.effectiveTo?.toISOString(),
    endReason: enrollment.endReason,
  };
}

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
    const enrollmentIds = enrollments.map((item) => item._id);
    const [students, subjectRows, batches, paymentProfiles] = await Promise.all([
      User.find({ _id: { $in: studentIds } }).select("name studentClass reference studentCode isActive").lean(),
      CoachingEnrollmentSubject.find({ enrollmentId: { $in: enrollmentIds }, status: "active" }).lean(),
      Batch.find({ _id: { $in: enrollments.map((item) => item.batchId) } }).select("name code").lean(),
      PaymentProfile.find({ userId: { $in: studentIds }, role: "student" }).select("userId defaultAmountTk").lean(),
    ]);
    const subjects = await AcademicSubject.find({ _id: { $in: subjectRows.map((item) => item.subjectId) } }).select("name nameBn code").lean();
    const studentById = new Map(students.map((student) => [String(student._id), student]));
    const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
    const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
    const feeByStudentId = new Map(paymentProfiles.map((profile) => [String(profile.userId), profile.defaultAmountTk]));

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
            reference: student?.reference,
            studentCode: student?.studentCode,
            isActive: student?.isActive,
          },
          batch: batchById.get(String(enrollment.batchId)),
          subjects: subjectRows
            .filter((row) => String(row.enrollmentId) === String(enrollment._id))
            .map((row) => ({ id: String(row.subjectId), ...subjectById.get(String(row.subjectId)) })),
          feeTk: feeByStudentId.get(String(enrollment.studentId)) ?? 0,
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

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) {
      throw new ApiRouteError("Academic write workflows are not enabled.", 503);
    }
    const parsed = enrollmentMutationSchema.parse(await request.json());

    const enrollment = parsed.action === "enroll"
        ? await createCoachingEnrollment({
            request,
            actor,
            batchId: parsed.batchId,
            studentId: parsed.studentId,
            subjectIds: parsed.subjectIds,
            effectiveFrom: parsed.effectiveFrom ?? new Date(),
            feeTk: parsed.feeTk,
            reason: parsed.reason,
          })
        : parsed.action === "transfer" ? await transferCoachingEnrollment({
            request,
            actor,
            enrollmentId: parsed.enrollmentId,
            targetBatchId: parsed.targetBatchId,
            subjectIds: parsed.subjectIds,
            effectiveAt: parsed.effectiveAt ?? new Date(),
            feeTk: parsed.feeTk,
            reason: parsed.reason,
          }) : parsed.action === "update-subjects" ? await updateCoachingSubjects({
            request, actor, enrollmentId: parsed.enrollmentId, subjectIds: parsed.subjectIds,
            effectiveAt: parsed.effectiveAt ?? new Date(), reason: parsed.reason,
            feeTk: parsed.feeTk,
          }) : await withdrawCoachingEnrollment({
            request, actor, enrollmentId: parsed.enrollmentId,
            effectiveAt: parsed.effectiveAt ?? new Date(), reason: parsed.reason,
          });

    return success(
      { enrollment: serializeEnrollment(enrollment) },
      parsed.action === "enroll" ? { status: 201 } : undefined,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
