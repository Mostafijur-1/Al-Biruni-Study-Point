import mongoose from "mongoose";

import { ApiRouteError } from "@/lib/api-error";
import type { SessionUser } from "@/types";
import { AttendanceRecord } from "@/lib/db/models/AttendanceRecord";
import { AttendanceSheet } from "@/lib/db/models/AttendanceSheet";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { StudentReportComment } from "@/lib/db/models/StudentReportComment";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { User } from "@/lib/db/models/User";
import { WrittenExam } from "@/lib/db/models/WrittenExam";
import { WrittenExamResult } from "@/lib/db/models/WrittenExamResult";
import { resolveCurrentWrittenResults } from "@/lib/repositories/written-exam-repository";

export type ReportPeriod = "week" | "month";

export type StudentReport = {
  periodType: ReportPeriod;
  periodStart: string;
  periodEnd: string;
  student: { id: string; name: string; studentCode?: string; studentClass?: string };
  batch: { id: string; name: string };
  guardian: { phone: string; relation: string };
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number | null;
  };
  dailyMcqPractice: { attempts: number; averagePercent: number | null; bestPercent: number | null };
  weeklyMcqTests: Array<{ title: string; subject: string; score: number; totalMarks: number; percentage: number; date: string }>;
  writtenExams: Array<{ title: string; subject: string; marks: number; totalMarks: number; percentage: number; date: string; comment?: string }>;
  comments: Array<{ id: string; comment: string; authorName: string; authorRole: string; createdAt: string }>;
  weeklyBreakdown: Array<{ start: string; end: string; attendancePercent: number | null; practiceAverage: number | null; mcqTestAverage: number | null; writtenAverage: number | null }>;
};

function startOfWeek(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function rangeFor(periodType: ReportPeriod, selectedDate: Date) {
  const start = periodType === "month"
    ? new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1))
    : startOfWeek(selectedDate);
  const end = periodType === "month"
    ? new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + 1, 1))
    : new Date(start.getTime() + 7 * 86_400_000);
  return { start, end };
}

function average(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}

async function assignedStudentAccess(actor: SessionUser) {
  if (actor.role !== "teacher") return [];
  const now = new Date();
  const rows = await TeacherAssignment.find({
    teacherId: actor.id,
    status: "active",
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
  }).select("batchId studentIds").lean();
  return rows.map((row) => ({ batchId: String(row.batchId), studentIds: row.studentIds?.map(String) }));
}

async function assignedBatchIds(actor: SessionUser) {
  return [...new Set((await assignedStudentAccess(actor)).map((row) => row.batchId))];
}

function assignmentAllowsStudent(assignments: Awaited<ReturnType<typeof assignedStudentAccess>>, batchId: string, studentId: string) {
  return assignments.some((row) => row.batchId === batchId && (row.studentIds === undefined || row.studentIds.includes(studentId)));
}

export async function listReportStudents(actor: SessionUser) {
  const teacherAssignments = await assignedStudentAccess(actor);
  const teacherBatches = [...new Set(teacherAssignments.map((row) => row.batchId))];
  const enrollmentQuery = actor.role === "student"
    ? { studentId: actor.id }
    : actor.role === "teacher"
      ? { batchId: { $in: teacherBatches } }
      : {};
  const enrollments = await BatchEnrollment.find(enrollmentQuery)
    .sort({ effectiveFrom: -1 })
    .select("studentId batchId status guardianPhone guardianRelation effectiveFrom")
    .lean();
  const latestByStudent = new Map<string, (typeof enrollments)[number]>();
  for (const enrollment of enrollments) {
    const id = String(enrollment.studentId);
    if (!latestByStudent.has(id)) latestByStudent.set(id, enrollment);
  }
  const latest = [...latestByStudent.values()].filter((row) => actor.role !== "teacher" || assignmentAllowsStudent(teacherAssignments, String(row.batchId), String(row.studentId)));
  const [students, batches] = await Promise.all([
    User.find({ _id: { $in: latest.map((row) => row.studentId) }, role: "student" })
      .select("name studentCode studentClass isActive").sort({ name: 1 }).lean(),
    Batch.find({ _id: { $in: latest.map((row) => row.batchId) } }).select("name").lean(),
  ]);
  const enrollmentByStudent = new Map(latest.map((row) => [String(row.studentId), row]));
  const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
  return students.map((student) => {
    const enrollment = enrollmentByStudent.get(String(student._id));
    const batch = enrollment ? batchById.get(String(enrollment.batchId)) : undefined;
    return {
      id: String(student._id),
      name: student.name,
      studentCode: student.studentCode,
      studentClass: student.studentClass,
      isActive: student.isActive,
      enrollmentStatus: enrollment?.status,
      batchName: batch?.name ?? "Unassigned",
    };
  });
}

async function resolveStudentContext(actor: SessionUser, studentId: string, periodEnd: Date) {
  if (!mongoose.Types.ObjectId.isValid(studentId)) throw new ApiRouteError("Student not found.", 404);
  if (actor.role === "student" && actor.id !== studentId) throw new ApiRouteError("Forbidden", 403);
  const enrollment = await BatchEnrollment.findOne({
    studentId,
    effectiveFrom: { $lt: periodEnd },
  }).sort({ effectiveFrom: -1 });
  if (!enrollment) throw new ApiRouteError("Student has no batch enrollment.", 404);
  if (actor.role === "teacher") {
    const allowed = assignmentAllowsStudent(await assignedStudentAccess(actor), String(enrollment.batchId), studentId);
    if (!allowed) throw new ApiRouteError("This student is outside your assigned batches.", 403);
  }
  const [student, batch] = await Promise.all([
    User.findOne({ _id: studentId, role: "student" }).select("name studentCode studentClass").lean(),
    Batch.findById(enrollment.batchId).select("name").lean(),
  ]);
  if (!student || !batch) throw new ApiRouteError("Student or batch not found.", 404);
  return { student, batch, enrollment };
}

export async function buildStudentReport(input: {
  actor: SessionUser;
  studentId: string;
  periodType: ReportPeriod;
  selectedDate: Date;
}): Promise<StudentReport> {
  const { start, end } = rangeFor(input.periodType, input.selectedDate);
  const { student, batch, enrollment } = await resolveStudentContext(input.actor, input.studentId, end);

  const [sheets, practiceRows, mcqAttempts, storedWrittenResults, comments] = await Promise.all([
    AttendanceSheet.find({ batchId: enrollment.batchId, status: "submitted", submittedAt: { $gte: start, $lt: end } })
      .select("_id submittedAt").lean(),
    PracticeResult.find({ student: student._id, submittedAt: { $gte: start, $lt: end }, isCancelled: { $ne: true } })
      .select("percentage submittedAt").lean(),
    McqExamAttempt.find({ student: student._id, submittedAt: { $gte: start, $lt: end }, isCancelled: { $ne: true } })
      .select("exam score percentage totalMarksSnapshot submittedAt").lean(),
    WrittenExamResult.find({ studentId: student._id }).select("examId marks comment").lean(),
    StudentReportComment.find(input.periodType === "month" ? {
      studentId: student._id,
      $or: [
        { periodType: "month", periodStart: start },
        { periodType: "week", periodStart: { $gte: startOfWeek(start), $lt: end } },
      ],
    } : { studentId: student._id, periodType: "week", periodStart: start })
      .populate("authorId", "name").sort({ createdAt: 1 }).lean(),
  ]);
  const writtenResults = await resolveCurrentWrittenResults(storedWrittenResults);

  const [attendanceRows, publishedMcqExams, publishedWrittenExams] = await Promise.all([
    AttendanceRecord.find({ sheetId: { $in: sheets.map((sheet) => sheet._id) }, studentId: student._id, status: { $ne: "unmarked" } })
      .select("sheetId status").lean(),
    McqExam.find({ _id: { $in: mcqAttempts.map((row) => row.exam) }, resultsPublished: true })
      .select("title subject totalMarks").lean(),
    WrittenExam.find({
      _id: { $in: writtenResults.map((row) => row.examId) },
      batchId: enrollment.batchId,
      isPublished: true,
      examDate: { $gte: start, $lt: end },
    }).populate("subjectId", "name nameBn").lean(),
  ]);

  const sheetDate = new Map(sheets.map((sheet) => [String(sheet._id), sheet.submittedAt ?? start]));
  const mcqExamById = new Map(publishedMcqExams.map((exam) => [String(exam._id), exam]));
  const writtenExamById = new Map(publishedWrittenExams.map((exam) => [String(exam._id), exam]));
  const present = attendanceRows.filter((row) => row.status === "present").length;
  const absent = attendanceRows.filter((row) => row.status === "absent").length;
  const late = attendanceRows.filter((row) => row.status === "late").length;
  const excused = attendanceRows.filter((row) => row.status === "excused").length;
  const denominator = present + absent + late;
  const weeklyMcqTests = mcqAttempts.flatMap((row) => {
    const exam = mcqExamById.get(String(row.exam));
    return exam ? [{
      title: exam.title,
      subject: exam.subject,
      score: row.score,
      totalMarks: row.totalMarksSnapshot ?? exam.totalMarks,
      percentage: row.percentage,
      date: row.submittedAt.toISOString(),
    }] : [];
  });
  const writtenExams = writtenResults.flatMap((row) => {
    const exam = writtenExamById.get(String(row.examId));
    if (!exam) return [];
    const subject = exam.subjectId as unknown as { name?: string; nameBn?: string };
    return [{
      title: exam.title,
      subject: subject.nameBn || subject.name || "Written",
      marks: row.marks,
      totalMarks: exam.totalMarks,
      percentage: Math.round((row.marks / exam.totalMarks) * 1_000) / 10,
      date: exam.examDate.toISOString(),
      comment: row.comment,
    }];
  });

  const weeklyBreakdown: StudentReport["weeklyBreakdown"] = [];
  if (input.periodType === "month") {
    for (let weekStart = startOfWeek(start); weekStart < end; weekStart = new Date(weekStart.getTime() + 7 * 86_400_000)) {
      const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
      const inWeek = (value: Date) => value >= weekStart && value < weekEnd && value >= start && value < end;
      const weekAttendance = attendanceRows.filter((row) => inWeek(sheetDate.get(String(row.sheetId)) ?? start));
      const weekDenominator = weekAttendance.filter((row) => row.status !== "excused").length;
      const attended = weekAttendance.filter((row) => row.status === "present" || row.status === "late").length;
      weeklyBreakdown.push({
        start: new Date(Math.max(weekStart.getTime(), start.getTime())).toISOString(),
        end: new Date(Math.min(weekEnd.getTime(), end.getTime()) - 1).toISOString(),
        attendancePercent: weekDenominator ? Math.round((attended / weekDenominator) * 1_000) / 10 : null,
        practiceAverage: average(practiceRows.filter((row) => inWeek(row.submittedAt)).map((row) => row.percentage)),
        mcqTestAverage: average(weeklyMcqTests.filter((row) => inWeek(new Date(row.date))).map((row) => row.percentage)),
        writtenAverage: average(writtenExams.filter((row) => inWeek(new Date(row.date))).map((row) => row.percentage)),
      });
    }
  }

  return {
    periodType: input.periodType,
    periodStart: start.toISOString(),
    periodEnd: new Date(end.getTime() - 1).toISOString(),
    student: { id: String(student._id), name: student.name, studentCode: student.studentCode, studentClass: student.studentClass },
    batch: { id: String(batch._id), name: batch.name },
    guardian: input.actor.role === "admin"
      ? { phone: enrollment.guardianPhone ?? "", relation: enrollment.guardianRelation ?? "other" }
      : { phone: "", relation: "" },
    attendance: {
      total: attendanceRows.length,
      present,
      absent,
      late,
      excused,
      percentage: denominator ? Math.round(((present + late) / denominator) * 1_000) / 10 : null,
    },
    dailyMcqPractice: {
      attempts: practiceRows.length,
      averagePercent: average(practiceRows.map((row) => row.percentage)),
      bestPercent: practiceRows.length ? Math.max(...practiceRows.map((row) => row.percentage)) : null,
    },
    weeklyMcqTests,
    writtenExams,
    comments: comments.map((comment) => ({
      id: String(comment._id),
      comment: comment.comment,
      authorName: (comment.authorId as unknown as { name?: string })?.name ?? "Teacher/Admin",
      authorRole: comment.authorRole,
      createdAt: comment.createdAt.toISOString(),
    })),
    weeklyBreakdown,
  };
}

export function normalizeReportPeriodStart(periodType: ReportPeriod, selectedDate: Date) {
  return rangeFor(periodType, selectedDate).start;
}

export async function assertTeacherCanAccessBatch(actor: SessionUser, batchId: string) {
  if (actor.role === "admin") return;
  if (actor.role !== "teacher" || !(await assignedBatchIds(actor)).includes(batchId)) {
    throw new ApiRouteError("This batch is outside your teaching assignment.", 403);
  }
}
