import { Types } from "mongoose";
import { assessmentContentHash } from "../assessment-kernel.ts";
import { AssessmentAttempt } from "../db/models/AssessmentAttempt.ts";
import { AttendanceRecord } from "../db/models/AttendanceRecord.ts";
import { AttendanceSheet } from "../db/models/AttendanceSheet.ts";
import { BatchEnrollment } from "../db/models/BatchEnrollment.ts";
import { ClassSession } from "../db/models/ClassSession.ts";
import { FocusSession } from "../db/models/FocusSession.ts";
import { ReportingProjection, type ReportingProjectionType } from "../db/models/ReportingProjection.ts";
import { TeacherAssignment } from "../db/models/TeacherAssignment.ts";
import { rebuildFinanceMonthSummary } from "../finance/ledger-summary.ts";
import type { FinanceMonthSummary } from "../finance/ledger-summary.ts";
import { getDhakaDayBounds } from "../gamification/engagement-rules.ts";

export const REPORTING_SOURCE_LIMITS = { enrollments: 5_000, attendanceRecords: 20_000, attendanceSheets: 5_000, attempts: 20_000, focusSessions: 10_000, classSessions: 5_000, assignments: 5_000 } as const;
type Scope = { organizationId: string; branchId: string };
type ProjectionInput = Scope & { projectionType: ReportingProjectionType; subjectKey: string; periodKey: string; metrics: Record<string, unknown> };

export async function storeReportingProjection(input: ProjectionInput) {
  const sourceHash = assessmentContentHash(input.metrics);
  return ReportingProjection.findOneAndUpdate(
    { organizationId: input.organizationId, branchId: input.branchId, projectionType: input.projectionType, subjectKey: input.subjectKey, periodKey: input.periodKey },
    { $set: { schemaVersion: 1, sourceHash, metrics: input.metrics, rebuiltAt: new Date() } },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function readProjection(input: Scope & { projectionType: ReportingProjectionType; subjectKey: string; periodKey: string }) {
  if (process.env.REPORTING_PROJECTIONS_ENABLED?.trim().toLowerCase() !== "true") return null;
  return ReportingProjection.findOne(input).lean();
}

export async function readFinanceMonthProjection(input: { organizationId: string; period: string }): Promise<FinanceMonthSummary | null> {
  if (process.env.REPORTING_PROJECTIONS_ENABLED?.trim().toLowerCase() !== "true") return null;
  const projection = await ReportingProjection.findOne({ organizationId: input.organizationId, projectionType: "finance-monthly", subjectKey: "scope", periodKey: input.period }).sort({ rebuiltAt: -1 }).lean();
  const metrics = projection?.metrics;
  if (!metrics || metrics.period !== input.period || !Array.isArray(metrics.positions) || typeof metrics.netCashTk !== "number") return null;
  return metrics as unknown as FinanceMonthSummary;
}

export async function buildReportingProjectionRows(input: Scope & { date: Date }) {
  const day = getDhakaDayBounds(input.date);
  const month = day.key.slice(0, 7);
  const scope = { organizationId: new Types.ObjectId(input.organizationId), branchId: new Types.ObjectId(input.branchId) };
  const enrollments = await BatchEnrollment.find({ ...scope, status: "active" }).select("studentId").limit(REPORTING_SOURCE_LIMITS.enrollments).lean();
  const studentIds = [...new Set(enrollments.map((row) => String(row.studentId)))].map((id) => new Types.ObjectId(id));
  const [sheets, records, attempts, focus, sessions, assignments, finance] = await Promise.all([
    AttendanceSheet.find({ ...scope, status: "submitted", submittedAt: { $gte: day.start, $lte: day.end } }).select("teacherId summary submittedAt").limit(REPORTING_SOURCE_LIMITS.attendanceSheets).lean(),
    AttendanceRecord.find({ ...scope, studentId: { $in: studentIds }, createdAt: { $gte: day.start, $lte: day.end }, status: { $ne: "unmarked" } }).select("studentId status").limit(REPORTING_SOURCE_LIMITS.attendanceRecords).lean(),
    AssessmentAttempt.find({ organizationId: scope.organizationId, studentId: { $in: studentIds }, status: "submitted", submittedAt: { $gte: day.start, $lte: day.end } }).select("studentId score totalMarks percentage passed submittedAt").limit(REPORTING_SOURCE_LIMITS.attempts).lean(),
    FocusSession.find({ student: { $in: studentIds }, dateKey: day.key, status: "completed" }).select("student durationMinutes xpEarned").limit(REPORTING_SOURCE_LIMITS.focusSessions).lean(),
    ClassSession.find({ ...scope, scheduledStart: { $gte: day.start, $lte: day.end } }).select("teacherId status").limit(REPORTING_SOURCE_LIMITS.classSessions).lean(),
    TeacherAssignment.find({ ...scope, status: "active" }).select("teacherId").limit(REPORTING_SOURCE_LIMITS.assignments).lean(),
    rebuildFinanceMonthSummary({ organizationId: input.organizationId, period: month }),
  ]);
  const sumSheet = sheets.reduce((sum, row) => ({ sheets: sum.sheets + 1, present: sum.present + (row.summary?.present ?? 0), absent: sum.absent + (row.summary?.absent ?? 0), late: sum.late + (row.summary?.late ?? 0), excused: sum.excused + (row.summary?.excused ?? 0), attended: sum.attended + (row.summary?.attended ?? 0), denominator: sum.denominator + (row.summary?.denominator ?? 0) }), { sheets: 0, present: 0, absent: 0, late: 0, excused: 0, attended: 0, denominator: 0 });
  const projections: ProjectionInput[] = [{ ...input, projectionType: "attendance-daily", subjectKey: "scope", periodKey: day.key, metrics: { ...sumSheet, percentage: sumSheet.denominator ? Number(((sumSheet.attended / sumSheet.denominator) * 100).toFixed(2)) : undefined } }];
  for (const studentId of studentIds) {
    const studentAttempts = attempts.filter((row) => String(row.studentId) === String(studentId));
    const studentRecords = records.filter((row) => String(row.studentId) === String(studentId));
    const studentFocus = focus.filter((row) => String(row.student) === String(studentId));
    projections.push({ ...input, projectionType: "student-today", subjectKey: String(studentId), periodKey: day.key, metrics: { assessmentAttempts: studentAttempts.length, assessmentAveragePercent: studentAttempts.length ? Number((studentAttempts.reduce((sum, row) => sum + (row.percentage ?? 0), 0) / studentAttempts.length).toFixed(2)) : 0, assessmentsPassed: studentAttempts.filter((row) => row.passed).length, focusMinutes: studentFocus.reduce((sum, row) => sum + row.durationMinutes, 0), focusXp: studentFocus.reduce((sum, row) => sum + row.xpEarned, 0), attendance: studentRecords.map((row) => row.status) } });
  }
  const teacherIds = [...new Set([...assignments.map((row) => String(row.teacherId)), ...sessions.map((row) => String(row.teacherId))])];
  for (const teacherId of teacherIds) projections.push({ ...input, projectionType: "teacher-today", subjectKey: teacherId, periodKey: day.key, metrics: { activeAssignments: assignments.filter((row) => String(row.teacherId) === teacherId).length, scheduledClasses: sessions.filter((row) => String(row.teacherId) === teacherId).length, completedClasses: sessions.filter((row) => String(row.teacherId) === teacherId && row.status === "completed").length, submittedAttendanceSheets: sheets.filter((row) => String(row.teacherId) === teacherId).length } });
  const monthStart = new Date(`${month}-01T00:00:00+06:00`); const monthEnd = new Date(monthStart); monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1); monthEnd.setMilliseconds(-1);
  const monthlyAttempts = await AssessmentAttempt.find({ organizationId: scope.organizationId, studentId: { $in: studentIds }, status: "submitted", submittedAt: { $gte: monthStart, $lte: monthEnd } }).select("studentId percentage passed").limit(REPORTING_SOURCE_LIMITS.attempts).lean();
  for (const studentId of studentIds) {
    const rows = monthlyAttempts.filter((row) => String(row.studentId) === String(studentId));
    projections.push({ ...input, projectionType: "assessment-trend", subjectKey: String(studentId), periodKey: month, metrics: { attempts: rows.length, averagePercent: rows.length ? Number((rows.reduce((sum, row) => sum + (row.percentage ?? 0), 0) / rows.length).toFixed(2)) : 0, passed: rows.filter((row) => row.passed).length } });
  }
  projections.push({ ...input, projectionType: "finance-monthly", subjectKey: "scope", periodKey: month, metrics: finance as unknown as Record<string, unknown> });
  return { dayKey: day.key, month, projections, sourceLimits: REPORTING_SOURCE_LIMITS };
}

export async function rebuildReportingProjections(input: Scope & { date: Date }) {
  const built = await buildReportingProjectionRows(input);
  const { projections } = built;
  await ReportingProjection.bulkWrite(projections.map((row) => ({ updateOne: { filter: { organizationId: row.organizationId, branchId: row.branchId, projectionType: row.projectionType, subjectKey: row.subjectKey, periodKey: row.periodKey }, update: { $set: { schemaVersion: 1, sourceHash: assessmentContentHash(row.metrics), metrics: row.metrics, rebuiltAt: new Date() } }, upsert: true } })), { ordered: false });
  return { dayKey: built.dayKey, month: built.month, rebuilt: projections.length, byType: Object.fromEntries([...new Set(projections.map((row) => row.projectionType))].map((type) => [type, projections.filter((row) => row.projectionType === type).length])), sourceLimits: built.sourceLimits };
}

export async function reconcileProjection(input: Scope & { projectionType: ReportingProjectionType; subjectKey: string; periodKey: string; authoritativeMetrics: Record<string, unknown> }) {
  const projection = await ReportingProjection.findOne({ organizationId: input.organizationId, branchId: input.branchId, projectionType: input.projectionType, subjectKey: input.subjectKey, periodKey: input.periodKey }).lean();
  const authoritativeHash = assessmentContentHash(input.authoritativeMetrics);
  return { exists: Boolean(projection), matches: projection?.sourceHash === authoritativeHash, projectionHash: projection?.sourceHash, authoritativeHash };
}

export async function reconcileReportingProjections(input: Scope & { date: Date }) {
  const built = await buildReportingProjectionRows(input);
  const stored = await ReportingProjection.find({
    organizationId: input.organizationId,
    branchId: input.branchId,
    $or: [{ periodKey: built.dayKey }, { periodKey: built.month }],
  }).select("projectionType subjectKey periodKey sourceHash").limit(built.projections.length + 100).lean();
  const storedByKey = new Map(stored.map((row) => [`${row.projectionType}:${row.subjectKey}:${row.periodKey}`, row.sourceHash]));
  const expectedKeys = new Set(built.projections.map((row) => `${row.projectionType}:${row.subjectKey}:${row.periodKey}`));
  const mismatches: Array<{ key: string; reason: "hash-mismatch" | "missing" | "stale"; expectedHash?: string; actualHash?: string }> = built.projections.flatMap((row) => {
    const key = `${row.projectionType}:${row.subjectKey}:${row.periodKey}`;
    const expectedHash = assessmentContentHash(row.metrics);
    const actualHash = storedByKey.get(key);
    return actualHash === expectedHash ? [] : [{ key, reason: actualHash ? "hash-mismatch" : "missing", expectedHash, actualHash }];
  });
  for (const [key, actualHash] of storedByKey) if (!expectedKeys.has(key)) mismatches.push({ key, reason: "stale", actualHash });
  return { dayKey: built.dayKey, month: built.month, expected: built.projections.length, checked: stored.length, matches: mismatches.length === 0, mismatches };
}
