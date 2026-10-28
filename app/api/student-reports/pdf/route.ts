import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { createTextPdf } from "@/lib/simple-pdf";
import { buildStudentReport } from "@/lib/student-report-service";

const querySchema = z.object({
  studentId: z.string().regex(/^[a-f\d]{24}$/i),
  period: z.enum(["week", "month"]).default("month"),
  date: z.coerce.date().default(() => new Date()),
});

function percent(value: number | null) {
  return value === null ? "No data" : `${value}%`;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    const parsed = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const report = await buildStudentReport({
      actor,
      studentId: parsed.studentId,
      periodType: parsed.period,
      selectedDate: parsed.date,
    });
    const pdf = createTextPdf("Al-Biruni Study Point - Student Progress Report", [
      {
        heading: "Student Details",
        lines: [
          `Student Name: ${report.student.name}`,
          `Student ID: ${report.student.studentCode ?? "Not assigned"}`,
          `Batch: ${report.batch.name}`,
          `Period: ${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)}`,
        ],
      },
      {
        heading: "1. Class Attendance",
        lines: [
          `Total Classes: ${report.attendance.total} | Present: ${report.attendance.present} | Absent: ${report.attendance.absent}`,
          `Attendance Rate: ${percent(report.attendance.percentage)}`,
        ],
      },
      {
        heading: "2. Daily MCQ Exam",
        lines: [
          `Total Days: ${report.dailyMcqPractice.totalDays} | Attended: ${report.dailyMcqPractice.daysAttended} days | Missed: ${report.dailyMcqPractice.daysMissed} days`,
          `Overall Result: ${percent(report.dailyMcqPractice.averagePercent)}`,
        ],
      },
      {
        heading: `3. Weekly MCQ Exam (Total: ${report.weeklyMcqSummary.total})`,
        lines: report.weeklyMcqSummary.total === 0
          ? ["No Weekly MCQ Exam published in this period."]
          : [
              `Attended: ${report.weeklyMcqSummary.attended} | Missed: ${report.weeklyMcqSummary.missed}`,
              ...(report.weeklyMcqTests.length
                ? report.weeklyMcqTests.map(
                    (row) =>
                      `${row.date.slice(0, 10)} | ${row.subject} | ${row.title}: ${row.score}/${row.totalMarks} (${row.percentage}%)`
                  )
                : []),
            ],
      },
      {
        heading: `4. Written Exam (Total: ${report.writtenExamSummary.total})`,
        lines: report.writtenExamSummary.total === 0
          ? ["No Written Exam published in this period."]
          : [
              `Attended: ${report.writtenExamSummary.attended} | Missed: ${report.writtenExamSummary.missed}`,
              ...(report.writtenExams.length
                ? report.writtenExams.map(
                    (row) =>
                      `${row.date.slice(0, 10)} | ${row.subject} | ${row.title}: ${row.marks}/${row.totalMarks} (${row.percentage}%)${
                        row.comment ? ` | Comment: ${row.comment}` : ""
                      }`
                  )
                : []),
            ],
      },
      {
        heading: "5. Teacher Comments",
        lines: report.comments.length
          ? report.comments.map((row) => `${row.authorName} (${row.authorRole}): ${row.comment}`)
          : ["No comment recorded for this period."],
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
