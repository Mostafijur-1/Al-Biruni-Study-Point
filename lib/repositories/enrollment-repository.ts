import type { QueryFilter } from "mongoose";

import { canonicalScopeFilter } from "@/lib/application/scope-policy";
import type { RequestContext } from "@/lib/application/request-context";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment, type IBatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { CoachingEnrollmentSubject } from "@/lib/db/models/CoachingEnrollmentSubject";
import { PaymentProfile } from "@/lib/db/models/PaymentProfile";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { User } from "@/lib/db/models/User";
import type { EnrollmentListInput } from "@/lib/validations/academic.schema";

export async function findEnrollmentStudentCode(studentId: unknown) {
  return User.findById(studentId).select("studentCode").lean();
}

export async function listEnrollmentRecords(context: RequestContext, input: EnrollmentListInput) {
  const query: QueryFilter<IBatchEnrollment> = {
    ...canonicalScopeFilter<IBatchEnrollment>(context.scope),
    status: input.status,
  };
  if (input.batchId) query.batchId = input.batchId;
  if (context.actor.role === "teacher") {
    const now = new Date();
    const assignments = await TeacherAssignment.find({
      ...canonicalScopeFilter(context.scope),
      teacherId: context.actor.id,
      status: "active",
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
    }).select("batchId").lean();
    const assigned = assignments.map((row) => String(row.batchId));
    query.batchId = { $in: input.batchId ? (assigned.includes(input.batchId) ? [input.batchId] : []) : assigned };
  } else if (context.actor.role === "student") query.studentId = context.actor.id;
  else if (input.studentId) query.studentId = input.studentId;

  const enrollments = await BatchEnrollment.find(query).sort({ effectiveFrom: -1 }).limit(input.limit).lean();
  const studentIds = [...new Set(enrollments.map((row) => String(row.studentId)))];
  const enrollmentIds = enrollments.map((row) => row._id);
  const [students, subjectRows, batches, paymentProfiles] = await Promise.all([
    User.find({ _id: { $in: studentIds } }).select("name studentClass reference studentCode isActive").lean(),
    CoachingEnrollmentSubject.find({ enrollmentId: { $in: enrollmentIds }, status: "active" }).lean(),
    Batch.find({ ...canonicalScopeFilter(context.scope), _id: { $in: enrollments.map((row) => row.batchId) } }).select("name code").lean(),
    PaymentProfile.find({ userId: { $in: studentIds }, role: "student" }).select("userId defaultAmountTk").lean(),
  ]);
  const subjects = await AcademicSubject.find({
    ...canonicalScopeFilter(context.scope),
    _id: { $in: subjectRows.map((row) => row.subjectId) },
  }).select("name nameBn code").lean();
  return { enrollments, students, subjectRows, batches, paymentProfiles, subjects };
}
