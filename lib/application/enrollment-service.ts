import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { DomainError } from "@/lib/application/domain-error";
import { runIdempotentMutation } from "@/lib/application/idempotency";
import type { RequestContext } from "@/lib/application/request-context";
import { assignStudentCodeForBatch, createCoachingEnrollment, getStudentCodeContextForBatch, transferCoachingEnrollment, updateCoachingSubjects, withdrawCoachingEnrollment } from "@/lib/coaching-enrollment-service";
import { findEnrollmentStudentCode, listEnrollmentRecords } from "@/lib/repositories/enrollment-repository";
import type { EnrollmentListInput, EnrollmentMutationInput } from "@/lib/validations/academic.schema";

function serializeEnrollment(enrollment: { _id: unknown; organizationId?: unknown; branchId?: unknown; academicSessionId?: unknown; batchId: unknown; studentId: unknown; status: string; effectiveFrom: Date; effectiveTo?: Date; endReason?: string; guardianPhone?: string; guardianRelation?: string }) {
  return {
    id: String(enrollment._id), organizationId: enrollment.organizationId ? String(enrollment.organizationId) : undefined,
    branchId: enrollment.branchId ? String(enrollment.branchId) : undefined, academicSessionId: enrollment.academicSessionId ? String(enrollment.academicSessionId) : undefined,
    batchId: String(enrollment.batchId), studentId: String(enrollment.studentId), status: enrollment.status,
    effectiveFrom: enrollment.effectiveFrom.toISOString(), effectiveTo: enrollment.effectiveTo?.toISOString(), endReason: enrollment.endReason,
    guardianPhone: enrollment.guardianPhone, guardianRelation: enrollment.guardianRelation,
  };
}

export async function listEnrollments(context: RequestContext, input: EnrollmentListInput) {
  if (context.actor.role === "admin" && input.batchId && input.studentCodeContext === "true") {
    return { studentCodeContext: await getStudentCodeContextForBatch(input.batchId) };
  }
  const rows = await listEnrollmentRecords(context, input);
  const studentById = new Map(rows.students.map((student) => [String(student._id), student]));
  const subjectById = new Map(rows.subjects.map((subject) => [String(subject._id), subject]));
  const batchById = new Map(rows.batches.map((batch) => [String(batch._id), batch]));
  const feeByStudentId = new Map(rows.paymentProfiles.map((profile) => [String(profile.userId), profile.defaultAmountTk]));
  return { enrollments: rows.enrollments.map((enrollment) => {
    const student = studentById.get(String(enrollment.studentId));
    return {
      id: String(enrollment._id), organizationId: String(enrollment.organizationId), branchId: String(enrollment.branchId), academicSessionId: String(enrollment.academicSessionId), batchId: String(enrollment.batchId),
      student: { id: String(enrollment.studentId), name: student?.name ?? "Unknown student", studentClass: student?.studentClass, reference: student?.reference, studentCode: student?.studentCode, isActive: student?.isActive },
      batch: batchById.get(String(enrollment.batchId)),
      subjects: rows.subjectRows.filter((row) => String(row.enrollmentId) === String(enrollment._id)).map((row) => ({ id: String(row.subjectId), ...subjectById.get(String(row.subjectId)) })),
      feeTk: feeByStudentId.get(String(enrollment.studentId)) ?? 0, status: enrollment.status,
      effectiveFrom: enrollment.effectiveFrom.toISOString(), effectiveTo: enrollment.effectiveTo?.toISOString(), endReason: enrollment.endReason,
      ...(context.actor.role === "admin" ? { guardianPhone: enrollment.guardianPhone, guardianRelation: enrollment.guardianRelation } : {}),
    };
  }) };
}

export async function mutateEnrollment(context: RequestContext, input: EnrollmentMutationInput) {
  if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) throw new DomainError("Academic write workflows are not enabled.", 503);
  return runIdempotentMutation(context, { workflow: `enrollment.${input.action}`, targetId: "enrollmentId" in input ? input.enrollmentId : `${input.batchId}:${input.studentId}`, payload: input }, async () => {
    if (input.action === "assign-student-code") return { data: await assignStudentCodeForBatch({ request: context.request, actor: context.actor, ...input }) };
    const enrollment = input.action === "enroll" ? await createCoachingEnrollment({ request: context.request, actor: context.actor, batchId: input.batchId, studentId: input.studentId, subjectIds: input.subjectIds, studentCode: input.studentCode, effectiveFrom: input.effectiveFrom ?? new Date(), feeTk: input.feeTk, guardianPhone: input.guardianPhone, guardianRelation: input.guardianRelation, reason: input.reason })
      : input.action === "transfer" ? await transferCoachingEnrollment({ request: context.request, actor: context.actor, enrollmentId: input.enrollmentId, targetBatchId: input.targetBatchId, subjectIds: input.subjectIds, effectiveAt: input.effectiveAt ?? new Date(), feeTk: input.feeTk, guardianPhone: input.guardianPhone, guardianRelation: input.guardianRelation, reason: input.reason })
      : input.action === "update-subjects" ? await updateCoachingSubjects({ request: context.request, actor: context.actor, enrollmentId: input.enrollmentId, subjectIds: input.subjectIds, effectiveAt: input.effectiveAt ?? new Date(), reason: input.reason, feeTk: input.feeTk, guardianPhone: input.guardianPhone, guardianRelation: input.guardianRelation })
      : await withdrawCoachingEnrollment({ request: context.request, actor: context.actor, enrollmentId: input.enrollmentId, effectiveAt: input.effectiveAt ?? new Date(), reason: input.reason });
    const student = input.action === "enroll" ? await findEnrollmentStudentCode(enrollment.studentId) : undefined;
    return { data: { enrollment: serializeEnrollment(enrollment), studentCode: student?.studentCode }, status: input.action === "enroll" ? 201 : 200 };
  });
}
