import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { validateExamForPublication } from "@/lib/mcq/exam-invariants";
import { writeAuditLog } from "@/lib/audit/write-audit-log";

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
        const questions = await McqQuestion.find({ exam: id }).select("marks").lean();
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
