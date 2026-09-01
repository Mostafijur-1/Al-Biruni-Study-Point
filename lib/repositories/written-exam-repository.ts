import { Types } from "mongoose";

import type { RequestContext } from "@/lib/application/request-context";
import { canonicalScopeFilter } from "@/lib/application/scope-policy";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { User } from "@/lib/db/models/User";
import { WrittenExam } from "@/lib/db/models/WrittenExam";
import { WrittenExamResult } from "@/lib/db/models/WrittenExamResult";
import { WrittenExamResultCorrection } from "@/lib/db/models/WrittenExamResultCorrection";
import { replayWrittenResultCorrections } from "@/lib/written-exam/correction-history";

export async function resolveCurrentWrittenResults<T extends { _id: Types.ObjectId; marks: number; comment?: string }>(results: T[]) {
  if (!results.length) return results;
  const corrections = await WrittenExamResultCorrection.find({ resultId: { $in: results.map((row) => row._id) } }).sort({ resultId: 1, sequence: -1 }).limit(5_000).lean();
  const byResult = new Map<string, typeof corrections>();
  for (const correction of corrections) byResult.set(String(correction.resultId), [...(byResult.get(String(correction.resultId)) ?? []), correction]);
  return results.map((row) => {
    const history = byResult.get(String(row._id));
    if (!history?.length) return row;
    const replayed = replayWrittenResultCorrections({ marks: row.marks, comment: row.comment }, history);
    return { ...row, marks: replayed.current.marks, comment: replayed.current.comment, correctionSequence: replayed.correctionSequence };
  });
}

export async function findActiveWrittenExamAssignments(context: RequestContext) {
  const now = new Date();
  return TeacherAssignment.find({
    ...canonicalScopeFilter(context.scope), teacherId: context.actor.id, status: "active", effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
  }).select("batchId subjectId").lean();
}

export function findWrittenExam(context: RequestContext, examId: string, includeQuestionData = false) {
  const query = WrittenExam.findOne({ ...canonicalScopeFilter(context.scope), _id: examId });
  if (includeQuestionData) query.select("+questionFile.data batchId subjectId isPublished questionFile");
  return query;
}

export async function findWrittenExamBatchAndSubject(context: RequestContext, batchId: string, subjectId: string) {
  return Promise.all([
    Batch.findOne({ ...canonicalScopeFilter(context.scope), _id: batchId }),
    AcademicSubject.findOne({ ...canonicalScopeFilter(context.scope), _id: subjectId }),
  ]);
}

export async function isStudentEnrolledForExam(context: RequestContext, studentId: string, batchId: Types.ObjectId) {
  return Boolean(await BatchEnrollment.exists({ ...canonicalScopeFilter(context.scope), studentId, batchId, status: "active" }));
}

export async function listStudentWrittenExams(context: RequestContext) {
  const enrollments = await BatchEnrollment.find({ ...canonicalScopeFilter(context.scope), studentId: context.actor.id, status: "active" }).select("batchId").limit(100).lean();
  const exams = await WrittenExam.find({ ...canonicalScopeFilter(context.scope), batchId: { $in: enrollments.map((row) => row.batchId) }, isPublished: true }).sort({ examDate: -1 }).limit(100).lean();
  const [storedResults, batches, subjects] = await Promise.all([
    WrittenExamResult.find({ studentId: context.actor.id, examId: { $in: exams.map((exam) => exam._id) } }).limit(100).lean(),
    Batch.find({ ...canonicalScopeFilter(context.scope), _id: { $in: exams.map((exam) => exam.batchId) } }).select("name").lean(),
    AcademicSubject.find({ ...canonicalScopeFilter(context.scope), _id: { $in: exams.map((exam) => exam.subjectId) } }).select("name nameBn").lean(),
  ]);
  const results = await resolveCurrentWrittenResults(storedResults);
  return { exams, results, batches, subjects };
}

export async function listManagedWrittenExams(context: RequestContext, assignmentScopes: Array<{ batchId: Types.ObjectId; subjectId: Types.ObjectId }>) {
  const access = context.actor.role === "teacher" ? { $or: assignmentScopes.map((row) => ({ batchId: row.batchId, subjectId: row.subjectId })) } : {};
  const exams = await WrittenExam.find({ ...canonicalScopeFilter(context.scope), ...access }).sort({ examDate: -1, createdAt: -1 }).limit(100).lean();
  const [batches, subjects] = await Promise.all([
    Batch.find({ ...canonicalScopeFilter(context.scope), _id: { $in: exams.map((exam) => exam.batchId) } }).select("name").lean(),
    AcademicSubject.find({ ...canonicalScopeFilter(context.scope), _id: { $in: exams.map((exam) => exam.subjectId) } }).select("name nameBn").lean(),
  ]);
  return { exams, batches, subjects };
}

export async function loadWrittenExamRoster(context: RequestContext, exam: { _id: Types.ObjectId; batchId: Types.ObjectId }) {
  const enrollments = await BatchEnrollment.find({ ...canonicalScopeFilter(context.scope), batchId: exam.batchId, status: "active" }).select("studentId").limit(1_000).lean();
  const [students, storedResults] = await Promise.all([
    User.find({ _id: { $in: enrollments.map((row) => row.studentId) } }).select("name studentCode studentClass").sort({ studentCode: 1, name: 1 }).lean(),
    WrittenExamResult.find({ examId: exam._id }).limit(1_000).lean(),
  ]);
  const results = await resolveCurrentWrittenResults(storedResults);
  return { students, results };
}

export function createWrittenExamRecord(input: Record<string, unknown>) { return WrittenExam.create(input); }
export function saveWrittenExamRecord<T extends { save(): Promise<unknown> }>(exam: T) { return exam.save(); }
export function countWrittenExamResults(examId: Types.ObjectId) { return WrittenExamResult.countDocuments({ examId }); }

export async function saveWrittenExamMarks(context: RequestContext, exam: { _id: Types.ObjectId; batchId: Types.ObjectId }, results: Array<{ studentId: string; marks: number; comment?: string }>) {
  const enrollments = await BatchEnrollment.find({ ...canonicalScopeFilter(context.scope), batchId: exam.batchId, status: "active", studentId: { $in: results.map((row) => row.studentId) } }).limit(1_000).lean();
  const enrollmentByStudent = new Map(enrollments.map((row) => [String(row.studentId), row]));
  if (enrollments.length !== results.length) return { saved: false as const };
  await WrittenExamResult.bulkWrite(results.map((row) => ({ updateOne: {
    filter: { examId: exam._id, studentId: row.studentId },
    update: { $set: { marks: row.marks, comment: row.comment, enteredBy: new Types.ObjectId(context.actor.id), enrollmentId: enrollmentByStudent.get(row.studentId)!._id } }, upsert: true,
  } })));
  return { saved: true as const, count: results.length };
}
