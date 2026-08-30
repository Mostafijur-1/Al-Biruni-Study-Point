import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { createTextPdf } from "@/lib/simple-pdf";
import { buildStudentReport } from "@/lib/student-report-service";

const querySchema = z.object({
  studentId: z.string().regex(/^[a-f\d]{24}$/i),
  period: z.enum(["week", "month"]).default("week"),
  date: z.coerce.date().default(() => new Date()),
});

function percent(value: number | null) {
  return value === null ? "No data" : `${value}%`;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    const parsed = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const report = await buildStudentReport({ actor, studentId: parsed.studentId, periodType: parsed.period, selectedDate: parsed.date });
    const pdf = createTextPdf("ABSP Student Progress Report", [
      {
        heading: "Student",
        lines: [
          `Name: ${report.student.name}`,
          `Student ID: ${report.student.studentCode ?? "Not assigned"}`,
          `Batch: ${report.batch.name}`,
          `Period: ${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)}`,
          `Guardian: ${report.guardian.phone} (${report.guardian.relation})`,
        ],
      },
      {
        heading: "Attendance",
        lines: [`Attendance: ${percent(report.attendance.percentage)} | Present ${report.attendance.present}, Absent ${report.attendance.absent}, Late ${report.attendance.late}, Excused ${report.attendance.excused}`],
      },
      {
        heading: "Daily MCQ Practice",
        lines: [`Attempts: ${report.dailyMcqPractice.attempts} | Average: ${percent(report.dailyMcqPractice.averagePercent)} | Best: ${percent(report.dailyMcqPractice.bestPercent)}`],
      },
      {
        heading: "Weekly MCQ Tests",
        lines: report.weeklyMcqTests.length ? report.weeklyMcqTests.map((row) => `${row.date.slice(0, 10)} | ${row.subject} | ${row.title}: ${row.score}/${row.totalMarks} (${row.percentage}%)`) : ["No published MCQ test result."],
      },
      {
        heading: "Written Exams",
        lines: report.writtenExams.length ? report.writtenExams.map((row) => `${row.date.slice(0, 10)} | ${row.subject} | ${row.title}: ${row.marks}/${row.totalMarks} (${row.percentage}%)${row.comment ? ` | ${row.comment}` : ""}`) : ["No published written exam result."],
      },
      {
        heading: "Teacher / Admin Comments",
        lines: report.comments.length ? report.comments.map((row) => `${row.authorName} (${row.authorRole}): ${row.comment}`) : ["No comment."],
      },
    ]);
    const filename = `ABSP-${report.student.studentCode ?? "student"}-${parsed.period}-report.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
