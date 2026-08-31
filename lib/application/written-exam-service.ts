import { Types } from "mongoose";

import { DomainError } from "@/lib/application/domain-error";
import { runIdempotentMutation } from "@/lib/application/idempotency";
import type { RequestContext } from "@/lib/application/request-context";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { isCanonicalAcademicAuthorityEnabled } from "@/lib/db/canonical-scope-guard";
import { countWrittenExamResults, createWrittenExamRecord, findActiveWrittenExamAssignments, findWrittenExam, findWrittenExamBatchAndSubject, isStudentEnrolledForExam, listManagedWrittenExams, listStudentWrittenExams, loadWrittenExamRoster, saveWrittenExamMarks, saveWrittenExamRecord } from "@/lib/repositories/written-exam-repository";
import { WrittenExamResult } from "@/lib/db/models/WrittenExamResult";
import type { WrittenExamMutationInput } from "@/lib/validations/written-exam.schema";
import { materializeWrittenExamAssessment } from "@/lib/written-exam/assessment-adapter";
import { appendWrittenResultCorrection, publishWrittenResultsAtomically } from "@/lib/written-exam/publication-service";

function serializeExam(exam: { _id: unknown; batchId: unknown; subjectId: unknown; title: string; examDate: Date; totalMarks: number; questionFile?: { contentType?: string; fileName?: string }; questionLink?: { provider?: string }; instructions?: string; isPublished: boolean; publishedAt?: Date; createdAt: Date }, batchName?: string, subjectName?: string) {
  return { id: String(exam._id), batchId: String(exam.batchId), batchName, subjectId: String(exam.subjectId), subjectName, title: exam.title, examDate: exam.examDate.toISOString(), totalMarks: exam.totalMarks, hasQuestionFile: Boolean(exam.questionLink?.provider || exam.questionFile?.contentType), questionFileName: exam.questionLink?.provider === "google-drive" ? "Google Drive" : exam.questionFile?.fileName, instructions: exam.instructions, isPublished: exam.isPublished, publishedAt: exam.publishedAt?.toISOString(), createdAt: exam.createdAt.toISOString() };
}

async function assertExamAccess(context: RequestContext, examId: string, includeQuestionData = false) {
  const exam = await findWrittenExam(context, examId, includeQuestionData);
  if (!exam) throw new DomainError("Written exam not found.", 404);
  if (context.actor.role === "teacher") {
    const assignments = await findActiveWrittenExamAssignments(context);
    if (!assignments.some((row) => String(row.batchId) === String(exam.batchId) && String(row.subjectId) === String(exam.subjectId))) {
      throw new DomainError("This exam is outside your teaching assignment.", 403);
    }
  }
  return exam;
}

export async function getWrittenExamData(context: RequestContext, input: { examId?: string; question: boolean }) {
  if (input.examId && !Types.ObjectId.isValid(input.examId)) throw new DomainError("Written exam not found.", 404);
  if (input.examId && input.question) {
    const exam = await assertExamAccess(context, input.examId, true);
    if (context.actor.role === "student") {
      if (!exam.isPublished) throw new DomainError("Question file is not published.", 403);
      if (!(await isStudentEnrolledForExam(context, context.actor.id, exam.batchId))) throw new DomainError("Forbidden", 403);
    }
    if (exam.questionLink?.provider === "google-drive" && exam.questionLink.url) return { kind: "external-link" as const, url: exam.questionLink.url };
    if (!exam.questionFile?.data || !exam.questionFile.contentType) throw new DomainError("Question file not found.", 404);
    return { kind: "file" as const, bytes: new Uint8Array(exam.questionFile.data), contentType: exam.questionFile.contentType, fileName: exam.questionFile.fileName.replace(/["\\]/g, "") };
  }
  if (context.actor.role === "student") {
    const rows = await listStudentWrittenExams(context);
    const resultByExam = new Map(rows.results.map((row) => [String(row.examId), row]));
    const batchById = new Map(rows.batches.map((row) => [String(row._id), row.name]));
    const subjectById = new Map(rows.subjects.map((row) => [String(row._id), row.nameBn || row.name]));
    return { kind: "json" as const, data: { exams: rows.exams.flatMap((exam) => {
      const result = resultByExam.get(String(exam._id));
      return result ? [{ ...serializeExam(exam, batchById.get(String(exam.batchId)), subjectById.get(String(exam.subjectId))), marks: result.marks, comment: result.comment }] : [];
    }) } };
  }
  if (input.examId) {
    const exam = await assertExamAccess(context, input.examId);
    const roster = await loadWrittenExamRoster(context, exam);
    const resultByStudent = new Map(roster.results.map((row) => [String(row.studentId), row]));
    return { kind: "json" as const, data: { exam: serializeExam(exam), students: roster.students.map((student) => {
      const result = resultByStudent.get(String(student._id));
      return { id: String(student._id), name: student.name, studentCode: student.studentCode, studentClass: student.studentClass, marks: result?.marks, comment: result?.comment };
    }) } };
  }
  const assignments = context.actor.role === "teacher" ? await findActiveWrittenExamAssignments(context) : [];
  const rows = await listManagedWrittenExams(context, assignments);
  const batchById = new Map(rows.batches.map((row) => [String(row._id), row.name]));
  const subjectById = new Map(rows.subjects.map((row) => [String(row._id), row.nameBn || row.name]));
  return { kind: "json" as const, data: { exams: rows.exams.map((exam) => serializeExam(exam, batchById.get(String(exam.batchId)), subjectById.get(String(exam.subjectId)))) } };
}

export async function uploadWrittenExamQuestion(context: RequestContext, input: { examId: string; file: File }) {
  if (!Types.ObjectId.isValid(input.examId)) throw new DomainError("Written exam not found.", 404);
  await assertExamAccess(context, input.examId);
  void input.file;
  throw new DomainError("Written question uploads are disabled. This exam records marks and results only.", 405, "METHOD_NOT_ALLOWED");
}

export async function mutateWrittenExam(context: RequestContext, input: WrittenExamMutationInput) {
  return runIdempotentMutation(context, { workflow: `written-exam.${input.action}`, targetId: "examId" in input ? input.examId : `${input.batchId}:${input.subjectId}`, payload: input }, async () => {
    if (input.action === "create") {
      const [batch, subject] = await findWrittenExamBatchAndSubject(context, input.batchId, input.subjectId);
      if (!batch || !subject) throw new DomainError("Batch or subject not found.", 404);
      if (batch.organizationId && subject.organizationId && String(batch.organizationId) !== String(subject.organizationId)) throw new DomainError("Batch and subject belong to different organizations.", 409);
      if (isCanonicalAcademicAuthorityEnabled() && (!batch.organizationId || !batch.branchId || !batch.academicSessionId || !subject.organizationId)) throw new DomainError("Batch or subject canonical scope is incomplete.", 409);
      if (context.actor.role === "teacher") {
        const assignments = await findActiveWrittenExamAssignments(context);
        if (!assignments.some((row) => String(row.batchId) === input.batchId && String(row.subjectId) === input.subjectId)) throw new DomainError("You can only create written exams for an assigned batch and subject.", 403);
      }
      const exam = await createWrittenExamRecord({ ...input, organizationId: batch.organizationId, branchId: batch.branchId, academicSessionId: batch.academicSessionId, createdBy: context.actor.id, creatorRole: context.actor.role === "admin" ? "admin" : "teacher" });
      await writeAuditLog({ request: context.request, actor: context.actor, organizationId: batch.organizationId, branchId: batch.branchId, action: "written-exam.created", resourceType: "WrittenExam", resourceId: exam._id, reason: "Written exam created", after: { batchId: input.batchId, subjectId: input.subjectId, totalMarks: input.totalMarks, examDate: input.examDate.toISOString() } });
      return { exam: serializeExam(exam, batch.name, subject.nameBn || subject.name) };
    }
    const exam = await assertExamAccess(context, input.examId);
    if (input.action === "update") {
      if (exam.isPublished) throw new DomainError("Published exams cannot be edited.", 409);
      exam.title = input.title; exam.examDate = input.examDate; exam.totalMarks = input.totalMarks; exam.instructions = input.instructions;
      await saveWrittenExamRecord(exam);
      await writeAuditLog({ request: context.request, actor: context.actor, action: "written-exam.updated", resourceType: "WrittenExam", resourceId: exam._id, reason: "Draft written exam updated", after: { title: exam.title, totalMarks: exam.totalMarks, examDate: exam.examDate.toISOString() } });
      return { exam: serializeExam(exam) };
    }
    if (input.action === "save-marks") {
      if (exam.isPublished) throw new DomainError("Published marks are locked.", 409);
      if (input.results.some((row) => row.marks > exam.totalMarks)) throw new DomainError(`Marks cannot exceed ${exam.totalMarks}.`, 400, "VALIDATION_ERROR");
      const result = await saveWrittenExamMarks(context, exam, input.results);
      if (!result.saved) throw new DomainError("One or more students are not active in this batch.", 409);
      await writeAuditLog({ request: context.request, actor: context.actor, action: "written-exam.marks-saved", resourceType: "WrittenExam", resourceId: exam._id, reason: "Draft written marks entered or corrected", after: { savedCount: result.count } });
      return { savedCount: result.count };
    }
    if (input.action === "set-question-link") {
      if (exam.isPublished) throw new DomainError("Published exams cannot be edited.", 409);
      exam.questionLink = input.url ? { provider: "google-drive", url: input.url, setBy: new Types.ObjectId(context.actor.id), setAt: new Date() } : undefined;
      await saveWrittenExamRecord(exam);
      await writeAuditLog({ request: context.request, actor: context.actor, action: input.url ? "written-exam.question-link-set" : "written-exam.question-link-removed", resourceType: "WrittenExam", resourceId: exam._id, reason: input.url ? "Optional Google Drive question link set" : "Optional Google Drive question link removed", after: input.url ? { provider: "google-drive", host: new URL(input.url).hostname } : { provider: null } });
      return { linked: Boolean(input.url), provider: input.url ? "google-drive" : null };
    }
    if (input.action === "correct-result") {
      if (!exam.isPublished) throw new DomainError("Publish the written results before correcting them.", 409);
      if (input.marks > exam.totalMarks) throw new DomainError(`Marks cannot exceed ${exam.totalMarks}.`, 400, "VALIDATION_ERROR");
      if (!(await WrittenExamResult.exists({ examId: exam._id, studentId: input.studentId }))) throw new DomainError("Published written result not found.", 404);
      const correction = await appendWrittenResultCorrection(context, input);
      return { corrected: true, correctionId: String(correction._id), sequence: correction.sequence, marks: correction.after.marks, comment: correction.after.comment };
    }
    if (!(await countWrittenExamResults(exam._id))) throw new DomainError("Enter at least one student mark before publishing.", 409);
    let kernel: Awaited<ReturnType<typeof materializeWrittenExamAssessment>> | null = null;
    if (process.env.WRITTEN_EXAM_KERNEL_WRITES?.trim().toLowerCase() !== "false" && exam.organizationId) {
      kernel = await materializeWrittenExamAssessment({ examId: String(exam._id), organizationId: String(exam.organizationId), branchId: exam.branchId ? String(exam.branchId) : undefined, academicSessionId: exam.academicSessionId ? String(exam.academicSessionId) : undefined, batchId: String(exam.batchId), subjectId: String(exam.subjectId), title: exam.title, instructions: exam.instructions, totalMarks: exam.totalMarks, ownerId: context.actor.id, ownerRole: context.actor.role === "admin" ? "admin" : "teacher", questionLink: exam.questionLink?.url });
    }
    const published = await publishWrittenResultsAtomically(context, { examId: String(exam._id), assessmentId: kernel?.assessmentId, assessmentVersionId: kernel?.assessmentVersionId, questionVersionId: kernel?.questionVersionId });
    return { exam: serializeExam(published.exam), publicationId: String(published.publicationId), alreadyPublished: published.alreadyPublished };
  });
}
