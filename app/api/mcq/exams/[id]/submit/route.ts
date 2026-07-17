import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { scoreSubmittedAnswers } from "@/lib/mcq/answer-scoring";

const submitExamSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().int().min(0).max(3).nullable(),
    })
  ),
  timeTaken: z.number().min(0), // in seconds
  isCancelled: z.boolean().optional(),
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:exam-submit", user.id, {
      limit: 10,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const { id } = await context.params;

    const exam = await McqExam.findById(id).lean();
    if (!exam || !exam.isPublished) {
      return fail("Exam not found or not published.", 404);
    }

    const studentClass = user.studentClass || "class-9";
    if (!exam.targetClasses.includes(studentClass)) {
      return fail("This exam is not available for your class.", 403);
    }

    // Enforce single-attempt check
    const existingAttempt = await McqExamAttempt.findOne({
      student: user.id,
      exam: id,
    }).lean();

    if (existingAttempt) {
      return fail("You have already completed this exam.", 400);
    }

    const parsed = submitExamSchema.parse(await request.json());

    // Fetch all questions for this exam to grade
    const dbQuestions = await McqQuestion.find({ exam: id }).lean();
    const questionsMap = new Map(dbQuestions.map((q) => [q._id.toString(), q]));
    const scoring = scoreSubmittedAnswers(
      parsed.answers,
      dbQuestions.map((q) => ({
        id: q._id.toString(),
        correctIndex: q.correctIndex,
        marks: q.marks,
      })),
    );
    if (scoring.invalidQuestionIds.length > 0) {
      return fail("The submission contains questions that do not belong to this exam.", 400);
    }

    const score = scoring.score;
    const answersDoc = scoring.records.map((answer) => ({
      questionId: questionsMap.get(answer.questionId)!._id,
      selectedIndex: answer.selectedIndex,
      isCorrect: answer.isCorrect,
    }));

    const totalMarks = exam.totalMarks;
    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
    const isPassed = score >= exam.passMark;

    await McqExamAttempt.create({
      student: user.id,
      exam: id,
      answers: answersDoc,
      score,
      percentage,
      isPassed,
      timeTaken: parsed.timeTaken,
      attemptNo: 1,
      isCancelled: parsed.isCancelled || false,
      submittedAt: new Date(),
    });

    // Do NOT return solutions or correct index to the student immediately!
    return success({
      message: "Exam submitted successfully! Your teacher will publish the results soon.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
