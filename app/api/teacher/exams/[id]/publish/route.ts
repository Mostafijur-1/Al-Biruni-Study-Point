import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { validateExamForPublication } from "@/lib/mcq/exam-invariants";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { materializeLegacyMcqAssessment } from "@/lib/mcq/assessment-kernel-adapter";
import { isAssessmentKernelWriteEnabled } from "@/lib/mcq/kernel-rollout";

const togglePublishSchema = z.object({
  type: z.enum(["exam", "results"]),
  value: z.boolean(),
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const body = await request.json();
    const parsed = togglePublishSchema.parse(body);

    const exam = await McqExam.findOne({
      _id: id,
      teacher: user.id,
      isArchived: { $ne: true },
    });
    if (!exam) {
      return fail("Exam not found or you do not have permission to modify it.", 404);
    }

    const before = {
      isPublished: exam.isPublished,
      resultsPublished: exam.resultsPublished,
      publishedAt: exam.publishedAt?.toISOString() ?? null,
      publishedQuestionCount: exam.publishedQuestionCount ?? null,
      publishedTotalMarks: exam.publishedTotalMarks ?? null,
      version: exam.version ?? 0,
    };

    if (parsed.type === "exam") {
      if (parsed.value) {
        const questions = await McqQuestion.find({ exam: id }).sort({ order: 1 }).lean();
        const validation = validateExamForPublication({
          configuredTotalMarks: exam.totalMarks,
          passMark: exam.passMark,
          questions,
        });
        if (!validation.ok) {
          return fail(validation.message, 409, {
            code: validation.code,
            derivedTotalMarks: validation.derivedTotalMarks,
          });
        }
        exam.publishedAt ??= new Date();
        exam.publishedQuestionCount = validation.questionCount;
        exam.publishedTotalMarks = validation.totalMarks;
        if ((exam.version ?? 0) === 0) exam.version = 1;
        const kernel = isAssessmentKernelWriteEnabled() ? await materializeLegacyMcqAssessment({
          source: { collection: "McqExam", id: String(exam._id) },
          organizationId: exam.organizationId ? String(exam.organizationId) : undefined,
          subjectId: exam.subjectId ? String(exam.subjectId) : undefined,
          branchId: exam.branchId ? String(exam.branchId) : undefined,
          academicSessionId: exam.academicSessionId ? String(exam.academicSessionId) : undefined,
          title: exam.title, kind: "mcq-exam", durationSeconds: exam.duration * 60,
          passRule: { mode: "points", threshold: exam.passMark }, ownerId: user.id, ownerRole: "teacher",
          questions: questions.map((question) => ({
            id: String(question._id), organizationId: question.organizationId ? String(question.organizationId) : undefined,
            subjectId: question.subjectId ? String(question.subjectId) : undefined, chapterId: question.chapterId ? String(question.chapterId) : undefined,
            topicId: question.topicId ? String(question.topicId) : undefined, prompt: question.question, options: question.options,
            correctIndex: question.correctIndex, explanation: question.explanation, marks: question.marks, difficulty: question.difficulty,
            ownerId: user.id, ownerRole: "teacher", collection: "McqQuestion",
          })),
        }) : null;
        if (kernel) {
          exam.assessmentId = kernel.assessmentId; exam.assessmentVersionId = kernel.assessmentVersionId;
          await McqQuestion.bulkWrite(questions.map((question, index) => ({ updateOne: { filter: { _id: question._id }, update: { $set: { questionId: kernel.questionIds[index], questionVersionId: kernel.questionVersionIds[index] } } } })));
        }
      } else if (exam.resultsPublished) {
        return fail("Unpublish the results before unpublishing the exam.", 409);
      }
      exam.isPublished = parsed.value;
    } else {
      if (parsed.value && !exam.isPublished) {
        return fail("Publish the exam before publishing its results.", 409);
      }
      exam.resultsPublished = parsed.value;
    }
    await exam.save();

    try {
      await writeAuditLog({
        request,
        actor: user,
        action: parsed.type === "exam" ? "mcq-exam.publish-state" : "mcq-results.publish-state",
        resourceType: "McqExam",
        resourceId: exam._id,
        reason: `${parsed.type} publication set to ${parsed.value}`,
        before,
        after: {
          isPublished: exam.isPublished,
          resultsPublished: exam.resultsPublished,
          publishedAt: exam.publishedAt?.toISOString() ?? null,
          publishedQuestionCount: exam.publishedQuestionCount ?? null,
          publishedTotalMarks: exam.publishedTotalMarks ?? null,
          version: exam.version,
        },
      });
    } catch (error) {
      exam.isPublished = before.isPublished;
      exam.resultsPublished = before.resultsPublished;
      exam.publishedAt = before.publishedAt ? new Date(before.publishedAt) : undefined;
      exam.publishedQuestionCount = before.publishedQuestionCount ?? undefined;
      exam.publishedTotalMarks = before.publishedTotalMarks ?? undefined;
      exam.version = before.version;
      await exam.save();
      throw error;
    }

    return success({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}
