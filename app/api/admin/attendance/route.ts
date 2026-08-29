import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { ApiRouteError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth/session";
import { assignMissingStudentCodes } from "@/lib/coaching-enrollment-service";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { AttendanceRecord } from "@/lib/db/models/AttendanceRecord";
import { AttendanceSheet, type IAttendanceSheet } from "@/lib/db/models/AttendanceSheet";
import { Batch } from "@/lib/db/models/Batch";
import { ClassSession } from "@/lib/db/models/ClassSession";
import { User } from "@/lib/db/models/User";

const querySchema = z.object({
  batchId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    const parsed = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const sessionQuery: QueryFilter<InstanceType<typeof ClassSession>> = {};
    if (parsed.date) {
      const start = new Date(`${parsed.date}T00:00:00+06:00`);
      sessionQuery.scheduledStart = { $gte: start, $lt: new Date(start.getTime() + 86_400_000) };
    }
    const classSessions = parsed.date
      ? await ClassSession.find(sessionQuery).select("scheduledStart").lean()
      : [];
    const sheetQuery: QueryFilter<IAttendanceSheet> = { status: "submitted" };
    if (parsed.batchId) sheetQuery.batchId = parsed.batchId;
    if (parsed.date) sheetQuery.classSessionId = { $in: classSessions.map((item) => item._id) };
    const sheets = await AttendanceSheet.find(sheetQuery).sort({ submittedAt: -1 }).limit(500).lean();
    const records = await AttendanceRecord.find({
      sheetId: { $in: sheets.map((sheet) => sheet._id) },
      status: { $ne: "unmarked" },
    }).limit(5000).lean();

    const [students, batches, subjects, sessions, availableBatches] = await Promise.all([
      User.find({ _id: { $in: records.map((record) => record.studentId) } }).select("name studentCode").lean(),
      Batch.find({ _id: { $in: sheets.map((sheet) => sheet.batchId) } }).select("name code").lean(),
      AcademicSubject.find({ _id: { $in: sheets.map((sheet) => sheet.subjectId) } }).select("name nameBn").lean(),
      ClassSession.find({ _id: { $in: sheets.map((sheet) => sheet.classSessionId) } }).select("scheduledStart").lean(),
      Batch.find({ status: { $ne: "archived" } }).select("name code").sort({ name: 1 }).lean(),
    ]);
    const studentById = new Map(students.map((student) => [String(student._id), student]));
    const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
    const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
    const sessionById = new Map(sessions.map((session) => [String(session._id), session]));
    const sheetById = new Map(sheets.map((sheet) => [String(sheet._id), sheet]));

    const rows = records.map((record) => {
      const sheet = sheetById.get(String(record.sheetId))!;
      const student = studentById.get(String(record.studentId));
      const batch = batchById.get(String(sheet.batchId));
      const subject = subjectById.get(String(sheet.subjectId));
      const classSession = sessionById.get(String(sheet.classSessionId));
      return {
        id: String(record._id),
        studentId: String(record.studentId),
        studentCode: student?.studentCode,
        studentName: student?.name ?? record.studentNameSnapshot,
        date: (classSession?.scheduledStart ?? sheet.submittedAt ?? sheet.openedAt).toISOString(),
        status: record.status,
        minutesLate: record.minutesLate,
        batchId: String(sheet.batchId),
        batchName: batch?.name ?? batch?.code ?? "Unknown batch",
        subjectName: subject?.nameBn || subject?.name || "Unknown subject",
      };
    }).sort((left, right) => right.date.localeCompare(left.date) ||
      (left.studentCode ?? "").localeCompare(right.studentCode ?? ""));

    return success({
      rows,
      batches: availableBatches.map((batch) => ({ id: String(batch._id), name: batch.name, code: batch.code })),
      missingStudentCodeCount: new Set(rows.filter((row) => !row.studentCode).map((row) => row.studentId)).size,
      truncated: records.length === 5000 || sheets.length === 500,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    if (process.env.STUDENT_ID_WRITES_ENABLED?.trim().toLowerCase() !== "true") {
      throw new ApiRouteError("Student ID assignment is not enabled.", 503);
    }
    const body = await request.json() as { action?: string };
    if (body.action !== "backfill-student-codes") throw new ApiRouteError("Unsupported action.", 400);
    const result = await assignMissingStudentCodes({
      request,
      actor,
      reason: "Admin assigned permanent IDs to existing batch students",
    });
    return success({ assignedCount: result.assigned.length, skippedBatchIds: result.skippedBatchIds });
  } catch (error) {
    return handleApiError(error);
  }
}
