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
import { validateLegacyIndexResponses } from "@/lib/assessment-kernel";
import { recordAuthoritativeAssessmentAttempt } from "@/lib/mcq/assessment-attempt-adapter";
import {
  loadSubmissionSession,
  markAttemptSessionSubmitted,
} from "@/lib/mcq/attempt-session";

const submitExamSchema = z.object({
  attemptSessionId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().int().min(0).max(3).nullable(),
    })
  ),
  timeTaken: z.number().min(0).optional(),
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
    const parsed = submitExamSchema.parse(await request.json());

    const exam = await McqExam.findById(id).lean();
    if (!exam || !exam.isPublished || exam.isArchived) {
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
      if (String(existingAttempt.attemptSession) === parsed.attemptSessionId) {
        return success({
          message: "Exam submitted successfully! Your teacher will publish the results soon.",
          alreadySubmitted: true,
        });
      }
      return fail("You have already completed this exam.", 400);
    }

    const submissionSession = await loadSubmissionSession({
      sessionId: parsed.attemptSessionId,
      studentId: user.id,
      kind: "exam",
      examId: id,
      submittedQuestionIds: parsed.answers.map((answer) => answer.questionId),
    });
    if (!submissionSession.ok) {
      const completedAttempt = await McqExamAttempt.findOne({
        student: user.id,
        exam: id,
        attemptSession: parsed.attemptSessionId,
      }).lean();
      if (completedAttempt) {
        return success({
          message: "Exam submitted successfully! Your teacher will publish the results soon.",
          alreadySubmitted: true,
        });
      }

      const message = submissionSession.reason === "expired"
        ? "The exam submission window has expired."
        : "Exam attempt session validation failed.";
      return fail(message, 400);
    }

    // Fetch all questions for this exam to grade
    const dbQuestions = await McqQuestion.find({ exam: id }).lean();
    const responseValidation = validateLegacyIndexResponses(
      parsed.answers,
      dbQuestions.map((question) => String(question._id)),
    );
    if (!responseValidation.ok) {
      return fail(responseValidation.code === "DUPLICATE_RESPONSE"
        ? "The submission contains duplicate question responses."
        : "The submission contains an invalid question response.", 400);
    }
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

    const questionMarks = dbQuestions.map((question) => question.marks ?? 1);
    if (questionMarks.some((marks) => !Number.isFinite(marks) || marks <= 0)) {
      return fail("This exam has an invalid question mark configuration.", 409);
    }
    const totalMarks = questionMarks.reduce((sum, marks) => sum + marks, 0);
    if (totalMarks < 1 || exam.passMark > totalMarks) {
      return fail("This exam has an invalid total or pass mark configuration.", 409);
    }
    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
    const isPassed = score >= exam.passMark;
    const authoritativeAttempt = await recordAuthoritativeAssessmentAttempt({
      attemptSessionId: submissionSession.session._id.toString(), studentId: user.id,
      responses: scoring.records.map((answer) => ({
        questionId: answer.questionId, selectedIndex: answer.selectedIndex,
        isCorrect: answer.isCorrect, awardedMarks: answer.isCorrect ? (questionsMap.get(answer.questionId)?.marks ?? 1) : 0,
      })),
      score, totalMarks, percentage, passed: isPassed, submittedAt: submissionSession.submittedAt,
      voided: parsed.isCancelled || false,
    });

    const savedAttempt = await McqExamAttempt.findOneAndUpdate(
      { student: user.id, exam: id, attemptNo: 1 },
      {
        $setOnInsert: {
          attemptSession: submissionSession.session._id,
          assessmentAttemptId: authoritativeAttempt?._id,
          answers: answersDoc,
          questionSnapshots: dbQuestions.map((question) => ({
            questionId: question._id,
            question: question.question,
            questionBn: question.questionBn,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            marks: question.marks ?? 1,
          })),
          examSnapshot: {
            title: exam.title,
            duration: exam.duration,
            totalMarks,
            passMark: exam.passMark,
            version: exam.version ?? 0,
          },
          score,
          percentage,
          isPassed,
          timeTaken: submissionSession.timeTaken,
          isCancelled: parsed.isCancelled || false,
          totalMarksSnapshot: totalMarks,
          passMarkSnapshot: exam.passMark,
          examVersion: exam.version ?? 0,
          submittedAt: submissionSession.submittedAt,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (String(savedAttempt.attemptSession) !== parsed.attemptSessionId) {
      return fail("You have already completed this exam.", 400);
    }
    await markAttemptSessionSubmitted(
      submissionSession.session._id.toString(),
      submissionSession.submittedAt,
    );

    // Do NOT return solutions or correct index to the student immediately!
    return success({
      message: "Exam submitted successfully! Your teacher will publish the results soon.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
