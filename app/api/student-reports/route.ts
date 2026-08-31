import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { createRequestContext } from "@/lib/application/request-context";
import { addStudentReportComment } from "@/lib/application/student-report-application-service";
import { requireAuth } from "@/lib/auth/session";
import { buildStudentReport, listReportStudents } from "@/lib/student-report-service";

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
    return success(await addStudentReportComment(createRequestContext(request, actor), parsed), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
