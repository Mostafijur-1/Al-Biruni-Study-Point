import { DomainError } from "@/lib/application/domain-error";
import { runIdempotentMutation } from "@/lib/application/idempotency";
import type { RequestContext } from "@/lib/application/request-context";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { createReportComment, findReportBatch } from "@/lib/repositories/student-report-repository";
import { buildStudentReport, normalizeReportPeriodStart } from "@/lib/student-report-service";

export async function addStudentReportComment(context: RequestContext, input: { studentId: string; period: "week" | "month"; date: Date; comment: string }) {
  return runIdempotentMutation(context, { workflow: "student-report.comment", targetId: `${input.studentId}:${input.period}:${normalizeReportPeriodStart(input.period, input.date).toISOString()}`, payload: input }, async () => {
    const report = await buildStudentReport({ actor: context.actor, studentId: input.studentId, periodType: input.period, selectedDate: input.date });
    const batch = await findReportBatch(context, report.batch.id);
    if (!batch) throw new DomainError("Report batch not found.", 404);
    const periodStart = normalizeReportPeriodStart(input.period, input.date);
    const comment = await createReportComment(context, {
      organizationId: batch.organizationId, branchId: batch.branchId, academicSessionId: batch.academicSessionId,
      studentId: input.studentId, batchId: report.batch.id, periodType: input.period, periodStart, comment: input.comment,
    });
    await writeAuditLog({ request: context.request, actor: context.actor, organizationId: batch.organizationId, branchId: batch.branchId, action: "student-report.comment-added", resourceType: "StudentReportComment", resourceId: comment._id, reason: "Teacher or admin added a progress report comment", after: { studentId: input.studentId, periodType: input.period, periodStart: periodStart.toISOString() } });
    return { comment: { id: String(comment._id) } };
  });
}
