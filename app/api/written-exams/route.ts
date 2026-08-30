import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { isCanonicalAcademicAuthorityEnabled } from "@/lib/db/canonical-scope-guard";
import { z } from "zod";

import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/session";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";
import { User } from "@/lib/db/models/User";
import { WrittenExam } from "@/lib/db/models/WrittenExam";
import { WrittenExamResult } from "@/lib/db/models/WrittenExamResult";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record identifier.");
const createSchema = z.object({
  action: z.literal("create"), batchId: objectId, subjectId: objectId,
  title: z.string().trim().min(2).max(160), examDate: z.coerce.date(),
  totalMarks: z.coerce.number().min(1).max(10_000),
  instructions: z.string().trim().max(1_000).optional(),
});
const marksSchema = z.object({
  action: z.literal("save-marks"), examId: objectId,
  results: z.array(z.object({ studentId: objectId, marks: z.coerce.number().min(0), comment: z.string().trim().max(500).optional() })).min(1).max(500),
});
const publishSchema = z.object({ action: z.literal("publish"), examId: objectId });
const updateSchema = z.object({
  action: z.literal("update"), examId: objectId,
  title: z.string().trim().min(2).max(160), examDate: z.coerce.date(),
  totalMarks: z.coerce.number().min(1).max(10_000),
  instructions: z.string().trim().max(1_000).optional(),
});
const mutationSchema = z.discriminatedUnion("action", [createSchema, marksSchema, publishSchema, updateSchema]);

function hasExpectedQuestionSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "application/pdf") return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (contentType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

async function teacherAssignments(teacherId: string) {
  const now = new Date();
  return TeacherAssignment.find({
    teacherId, status: "active", effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
  }).select("batchId subjectId").lean();
}

async function assertExamAccess(examId: string, actor: { id: string; role: string }) {
  const exam = await WrittenExam.findById(examId);
  if (!exam) throw new ApiRouteError("Written exam not found.", 404);
  if (actor.role === "teacher") {
    const assignments = await teacherAssignments(actor.id);
    const allowed = assignments.some((row) => String(row.batchId) === String(exam.batchId) && String(row.subjectId) === String(exam.subjectId));
    if (!allowed) throw new ApiRouteError("This exam is outside your teaching assignment.", 403);
  }
  return exam;
}

function serializeExam(exam: {
  _id: unknown; batchId: unknown; subjectId: unknown; title: string; examDate: Date;
  totalMarks: number; questionFile?: { contentType?: string; fileName?: string }; instructions?: string; isPublished: boolean;
  publishedAt?: Date; createdAt: Date;
}, batchName?: string, subjectName?: string) {
  return {
    id: String(exam._id), batchId: String(exam.batchId), batchName,
    subjectId: String(exam.subjectId), subjectName, title: exam.title,
    examDate: exam.examDate.toISOString(), totalMarks: exam.totalMarks,
    hasQuestionFile: Boolean(exam.questionFile?.contentType), questionFileName: exam.questionFile?.fileName, instructions: exam.instructions,
    isPublished: exam.isPublished, publishedAt: exam.publishedAt?.toISOString(),
    createdAt: exam.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const examId = request.nextUrl.searchParams.get("examId");
    if (examId && request.nextUrl.searchParams.get("question") === "true") {
      const exam = await WrittenExam.findById(examId).select("+questionFile.data batchId subjectId isPublished questionFile");
      if (!exam?.questionFile?.data || !exam.questionFile.contentType) throw new ApiRouteError("Question file not found.", 404);
      if (actor.role === "student") {
        if (!exam.isPublished) throw new ApiRouteError("Question file is not published.", 403);
        const enrolled = await BatchEnrollment.exists({ studentId: actor.id, batchId: exam.batchId });
        if (!enrolled) throw new ApiRouteError("Forbidden", 403);
      } else if (actor.role === "teacher") {
        await assertExamAccess(examId, actor);
      }
      return new Response(new Uint8Array(exam.questionFile.data), { headers: {
        "Content-Type": exam.questionFile.contentType,
        "Content-Disposition": `inline; filename="${exam.questionFile.fileName.replace(/["\\]/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      } });
    }
    if (actor.role === "student") {
      const enrollments = await BatchEnrollment.find({ studentId: actor.id }).select("batchId").lean();
      const exams = await WrittenExam.find({ batchId: { $in: enrollments.map((row) => row.batchId) }, isPublished: true }).sort({ examDate: -1 }).lean();
      const [results, batches, subjects] = await Promise.all([
        WrittenExamResult.find({ studentId: actor.id, examId: { $in: exams.map((exam) => exam._id) } }).lean(),
        Batch.find({ _id: { $in: exams.map((exam) => exam.batchId) } }).select("name").lean(),
        AcademicSubject.find({ _id: { $in: exams.map((exam) => exam.subjectId) } }).select("name nameBn").lean(),
      ]);
      const resultByExam = new Map(results.map((row) => [String(row.examId), row]));
      const batchById = new Map(batches.map((row) => [String(row._id), row.name]));
      const subjectById = new Map(subjects.map((row) => [String(row._id), row.nameBn || row.name]));
      return success({ exams: exams.flatMap((exam) => {
        const result = resultByExam.get(String(exam._id));
        return result ? [{ ...serializeExam(exam, batchById.get(String(exam.batchId)), subjectById.get(String(exam.subjectId))), marks: result.marks, comment: result.comment }] : [];
      }) });
    }

    const assignments = actor.role === "teacher" ? await teacherAssignments(actor.id) : [];
    const scope = actor.role === "teacher" ? { $or: assignments.map((row) => ({ batchId: row.batchId, subjectId: row.subjectId })) } : {};
    if (examId) {
      if (!Types.ObjectId.isValid(examId)) throw new ApiRouteError("Written exam not found.", 404);
      const exam = await assertExamAccess(examId, actor);
      const enrollments = await BatchEnrollment.find({ batchId: exam.batchId, status: "active" }).select("studentId").lean();
      const [students, results] = await Promise.all([
        User.find({ _id: { $in: enrollments.map((row) => row.studentId) } }).select("name studentCode studentClass").sort({ studentCode: 1, name: 1 }).lean(),
        WrittenExamResult.find({ examId: exam._id }).lean(),
      ]);
      const resultByStudent = new Map(results.map((row) => [String(row.studentId), row]));
      return success({ exam: serializeExam(exam), students: students.map((student) => {
        const result = resultByStudent.get(String(student._id));
        return { id: String(student._id), name: student.name, studentCode: student.studentCode, studentClass: student.studentClass, marks: result?.marks, comment: result?.comment };
      }) });
    }
    const exams = await WrittenExam.find(scope).sort({ examDate: -1, createdAt: -1 }).limit(100).lean();
    const [batches, subjects] = await Promise.all([
      Batch.find({ _id: { $in: exams.map((exam) => exam.batchId) } }).select("name").lean(),
      AcademicSubject.find({ _id: { $in: exams.map((exam) => exam.subjectId) } }).select("name nameBn").lean(),
    ]);
    const batchById = new Map(batches.map((row) => [String(row._id), row.name]));
    const subjectById = new Map(subjects.map((row) => [String(row._id), row.nameBn || row.name]));
    return success({ exams: exams.map((exam) => serializeExam(exam, batchById.get(String(exam.batchId)), subjectById.get(String(exam.subjectId)))) });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher"]);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const examId = String(form.get("examId") ?? "");
      const file = form.get("file");
      if (!Types.ObjectId.isValid(examId) || !(file instanceof File) || file.size === 0) throw new ApiRouteError("A valid exam and question file are required.", 400, "VALIDATION_ERROR");
      if (file.size > 5 * 1024 * 1024) throw new ApiRouteError("Question file must be 5 MB or smaller.", 413);
      if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) throw new ApiRouteError("Question must be a JPG, PNG, WebP, or PDF file.", 400, "VALIDATION_ERROR");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasExpectedQuestionSignature(bytes, file.type)) throw new ApiRouteError("The question file content does not match its declared type.", 400, "VALIDATION_ERROR");
      const exam = await assertExamAccess(examId, actor);
      if (exam.isPublished) throw new ApiRouteError("Published exams cannot be edited.", 409);
      exam.questionFile = { data: Buffer.from(bytes), contentType: file.type, fileName: file.name };
      await exam.save();
      await writeAuditLog({ request, actor, action: "written-exam.question-uploaded", resourceType: "WrittenExam", resourceId: exam._id, reason: "Question file attached to written exam", after: { fileName: file.name, contentType: file.type, size: file.size } });
      return success({ uploaded: true, fileName: file.name });
    }
    const parsed = mutationSchema.parse(await request.json());
    if (parsed.action === "create") {
      const [batch, subject] = await Promise.all([Batch.findById(parsed.batchId), AcademicSubject.findById(parsed.subjectId)]);
      if (!batch || !subject) throw new ApiRouteError("Batch or subject not found.", 404);
      if (batch.organizationId && subject.organizationId && String(batch.organizationId) !== String(subject.organizationId)) {
        throw new ApiRouteError("Batch and subject belong to different organizations.", 409);
      }
      if (isCanonicalAcademicAuthorityEnabled() && (!batch.organizationId || !batch.branchId || !batch.academicSessionId || !subject.organizationId)) {
        throw new ApiRouteError("Batch or subject canonical scope is incomplete.", 409);
      }
      if (actor.role === "teacher") {
        const assignments = await teacherAssignments(actor.id);
        if (!assignments.some((row) => String(row.batchId) === parsed.batchId && String(row.subjectId) === parsed.subjectId)) {
          throw new ApiRouteError("You can only create written exams for an assigned batch and subject.", 403);
        }
      }
      const exam = await WrittenExam.create({
        ...parsed,
        organizationId: batch.organizationId,
        branchId: batch.branchId,
        academicSessionId: batch.academicSessionId,
        createdBy: actor.id,
        creatorRole: actor.role === "admin" ? "admin" : "teacher",
      });
      await writeAuditLog({ request, actor, organizationId: batch.organizationId, branchId: batch.branchId, action: "written-exam.created", resourceType: "WrittenExam", resourceId: exam._id, reason: "Written exam created", after: { batchId: parsed.batchId, subjectId: parsed.subjectId, totalMarks: parsed.totalMarks, examDate: parsed.examDate.toISOString() } });
      return success({ exam: serializeExam(exam, batch.name, subject.nameBn || subject.name) }, { status: 201 });
    }
    const exam = await assertExamAccess(parsed.examId, actor);
    if (parsed.action === "update") {
      if (exam.isPublished) throw new ApiRouteError("Published exams cannot be edited.", 409);
      exam.title = parsed.title; exam.examDate = parsed.examDate; exam.totalMarks = parsed.totalMarks;
      exam.instructions = parsed.instructions;
      await exam.save();
      await writeAuditLog({ request, actor, action: "written-exam.updated", resourceType: "WrittenExam", resourceId: exam._id, reason: "Draft written exam updated", after: { title: exam.title, totalMarks: exam.totalMarks, examDate: exam.examDate.toISOString() } });
      return success({ exam: serializeExam(exam) });
    }
    if (parsed.action === "save-marks") {
      if (exam.isPublished) throw new ApiRouteError("Published marks are locked.", 409);
      if (parsed.results.some((row) => row.marks > exam.totalMarks)) throw new ApiRouteError(`Marks cannot exceed ${exam.totalMarks}.`, 400, "VALIDATION_ERROR");
      const enrollments = await BatchEnrollment.find({ batchId: exam.batchId, status: "active", studentId: { $in: parsed.results.map((row) => row.studentId) } }).lean();
      const enrollmentByStudent = new Map(enrollments.map((row) => [String(row.studentId), row]));
      if (enrollments.length !== parsed.results.length) throw new ApiRouteError("One or more students are not active in this batch.", 409);
      await WrittenExamResult.bulkWrite(parsed.results.map((row) => ({ updateOne: {
        filter: { examId: exam._id, studentId: row.studentId },
        update: { $set: { marks: row.marks, comment: row.comment, enteredBy: new Types.ObjectId(actor.id), enrollmentId: enrollmentByStudent.get(row.studentId)!._id } }, upsert: true,
      } })));
      await writeAuditLog({ request, actor, action: "written-exam.marks-saved", resourceType: "WrittenExam", resourceId: exam._id, reason: "Draft written marks entered or corrected", after: { savedCount: parsed.results.length } });
      return success({ savedCount: parsed.results.length });
    }
    const resultCount = await WrittenExamResult.countDocuments({ examId: exam._id });
    if (!resultCount) throw new ApiRouteError("Enter at least one student mark before publishing.", 409);
    exam.isPublished = true; exam.publishedAt = new Date(); exam.publishedBy = new Types.ObjectId(actor.id);
    await exam.save();
    await writeAuditLog({ request, actor, action: "written-exam.published", resourceType: "WrittenExam", resourceId: exam._id, reason: "Written exam results explicitly published to students", after: { resultCount, publishedAt: exam.publishedAt.toISOString() } });
    return success({ exam: serializeExam(exam) });
  } catch (error) { return handleApiError(error); }
}
