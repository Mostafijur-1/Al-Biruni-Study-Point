import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { StudentReportComment } from "@/lib/db/models/StudentReportComment";
import { buildStudentReport, listReportStudents, normalizeReportPeriodStart } from "@/lib/student-report-service";

const querySchema = z.object({
  studentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  period: z.enum(["week", "month"]).default("week"),
  date: z.coerce.date().default(() => new Date()),
});

const commentSchema = z.object({
  studentId: z.string().regex(/^[a-f\d]{24}$/i),
  period: z.enum(["week", "month"]),
  date: z.coerce.date(),
  comment: z.string().trim().min(2).max(1_000),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const parsed = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const studentId = actor.role === "student" ? actor.id : parsed.studentId;
    if (!studentId) return success({ students: await listReportStudents(actor) });
    return success({
      report: await buildStudentReport({
        actor,
        studentId,
        periodType: parsed.period,
        selectedDate: parsed.date,
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher"]);
    const parsed = commentSchema.parse(await request.json());
    const report = await buildStudentReport({ actor, studentId: parsed.studentId, periodType: parsed.period, selectedDate: parsed.date });
    const comment = await StudentReportComment.create({
      studentId: parsed.studentId,
      batchId: report.batch.id,
      periodType: parsed.period,
      periodStart: normalizeReportPeriodStart(parsed.period, parsed.date),
      comment: parsed.comment,
      authorId: actor.id,
      authorRole: actor.role === "admin" ? "admin" : "teacher",
    });
    await writeAuditLog({ request, actor, action: "student-report.comment-added", resourceType: "StudentReportComment", resourceId: comment._id, reason: "Teacher or admin added a progress report comment", after: { studentId: parsed.studentId, periodType: parsed.period, periodStart: normalizeReportPeriodStart(parsed.period, parsed.date).toISOString() } });
    return success({ comment: { id: String(comment._id) } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
