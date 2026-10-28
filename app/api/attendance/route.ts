import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { ApiRouteError } from "@/lib/api-error";
import { areAttendanceWritesEnabled, canManageAttendance } from "@/lib/attendance-rules";
import { amendSubmittedAttendance, getAttendanceIdempotencyKey, markAttendance, openAttendanceSheet, openRoutineAttendanceSheet, submitAttendance } from "@/lib/attendance-service";
import { AttendanceRecord } from "@/lib/db/models/AttendanceRecord";
import { AttendanceSheet } from "@/lib/db/models/AttendanceSheet";
import { amendAttendanceSchema, markAttendanceSchema, openAttendanceSheetSchema, openRoutineAttendanceSheetSchema, submitAttendanceSchema } from "@/lib/validations/attendance.schema";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

function serializeSheet(sheet: InstanceType<typeof AttendanceSheet> | Record<string, unknown>) {
  const item = sheet as InstanceType<typeof AttendanceSheet>;
  return {
    id: String(item._id), classSessionId: String(item.classSessionId), batchId: String(item.batchId), subjectId: String(item.subjectId),
    teacherId: String(item.teacherId), status: item.status, version: item.workflowVersion,
    openedAt: item.openedAt.toISOString(), submittedAt: item.submittedAt?.toISOString(), summary: item.summary,
  };
}

async function getSheetRecords(sheetId: Types.ObjectId | string) {
  const records = await AttendanceRecord.find({ sheetId })
    .select("enrollmentId studentNameSnapshot studentCodeSnapshot studentClassSnapshot status minutesLate")
    .lean();

  records.sort((a, b) => {
    const codeA = a.studentCodeSnapshot?.trim() || "";
    const codeB = b.studentCodeSnapshot?.trim() || "";
    if (codeA && codeB) {
      const cmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return cmp;
    } else if (codeA) {
      return -1;
    } else if (codeB) {
      return 1;
    }
    return (a.studentNameSnapshot || "").localeCompare(b.studentNameSnapshot || "");
  });

  return records.map((record) => ({
    id: String(record._id),
    enrollmentId: String(record.enrollmentId),
    studentName: record.studentNameSnapshot,
    studentCode: record.studentCodeSnapshot,
    studentClass: record.studentClassSnapshot,
    status: record.status,
    minutesLate: record.minutesLate,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const sheetId = request.nextUrl.searchParams.get("sheetId");
    const classSessionId = request.nextUrl.searchParams.get("classSessionId");
    if (actor.role === "student") {
      const records = await AttendanceRecord.find({ studentId: actor.id, status: { $ne: "unmarked" } }).sort({ createdAt: -1 }).limit(100).lean();
      const sheets = await AttendanceSheet.find({ _id: { $in: records.map((record) => record.sheetId) }, status: "submitted" }).select("classSessionId subjectId submittedAt summary").lean();
      const sheetById = new Map(sheets.map((sheet) => [String(sheet._id), sheet]));
      return success({ records: records.filter((record) => sheetById.has(String(record.sheetId))).map((record) => ({ id: String(record._id), status: record.status, classSessionId: String(record.classSessionId), subjectId: String(sheetById.get(String(record.sheetId))!.subjectId), submittedAt: sheetById.get(String(record.sheetId))!.submittedAt?.toISOString() })) });
    }
    if (!sheetId && !classSessionId) throw new ApiRouteError("sheetId or classSessionId is required.", 400);
    const sheet = sheetId ? await AttendanceSheet.findById(objectId.parse(sheetId)) : await AttendanceSheet.findOne({ classSessionId: objectId.parse(classSessionId) });
    if (!sheet) return success({ sheet: null, records: [] });
    if (!canManageAttendance(actor.role, actor.id, String(sheet.teacherId))) throw new ApiRouteError("Attendance sheet not found.", 404);
    const records = await getSheetRecords(sheet._id);
    return success({ sheet: serializeSheet(sheet), records });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher"]);
    const attendanceWritesFlag = process.env.ATTENDANCE_WRITES_ENABLED ?? "true";
    if (!areAttendanceWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED, attendanceWritesFlag)) {
      throw new ApiRouteError("Attendance write workflow is not enabled.", 503);
    }
    const body = await request.json() as { action?: string; sheetId?: string };
    if (body.action === "open") {
      const parsed = openAttendanceSheetSchema.parse(body);
      const result = await openAttendanceSheet({ request, actor, ...parsed });
      const records = await getSheetRecords(result.sheet._id);
      return success({ sheet: serializeSheet(result.sheet), created: result.created, records }, result.created ? { status: 201 } : undefined);
    }
    if (body.action === "open-routine") {
      const parsed = openRoutineAttendanceSheetSchema.parse(body);
      const result = await openRoutineAttendanceSheet({ request, actor, ...parsed });
      const records = await getSheetRecords(result.sheet._id);
      return success({ sheet: serializeSheet(result.sheet), created: result.created, records }, result.created ? { status: 201 } : undefined);
    }
    if (!body.sheetId) throw new ApiRouteError("sheetId is required.", 400);
    const sheetId = objectId.parse(body.sheetId);
    if (body.action === "mark") {
      const parsed = markAttendanceSchema.parse(body);
      const sheet = await markAttendance({ request, actor, sheetId, ...parsed });
      const records = await getSheetRecords(sheet._id);
      return success({ sheet: serializeSheet(sheet), records });
    }
    if (body.action === "submit") {
      const parsed = submitAttendanceSchema.parse(body);
      const result = await submitAttendance({ request, actor, sheetId, ...parsed, idempotencyKey: getAttendanceIdempotencyKey(request) });
      const records = await getSheetRecords(result.sheet._id);
      return success({ sheet: serializeSheet(result.sheet), records, replayed: result.replayed });
    }
    if (body.action === "amend") {
      const parsed = amendAttendanceSchema.parse(body);
      const result = await amendSubmittedAttendance({ request, actor, sheetId, ...parsed, idempotencyKey: getAttendanceIdempotencyKey(request) });
      const records = await getSheetRecords(result.sheet._id);
      return success({ sheet: serializeSheet(result.sheet), records, changedCount: result.changedCount, replayed: result.replayed });
    }
    throw new ApiRouteError("Unsupported attendance action.", 400);
  } catch (error) { return handleApiError(error); }
}
