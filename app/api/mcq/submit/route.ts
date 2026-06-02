import { NextRequest } from "next/server";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { studentCanAccessExam } from "@/lib/mcq/exam-access";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { Result } from "@/lib/db/models/Result";
import { scoreMcqAttempt } from "@/lib/mcq/scoring";
import { submitMcqExamSchema } from "@/lib/validations/mcq.schema";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "student"]);
    const parsed = submitMcqExamSchema.parse(await request.json());

    const exam = await McqExam.findById(parsed.examId);

    if (!exam || !exam.isPublished) {
      return fail("Exam is not available.", 404);
    }

    const studentClass = requireStudentClass(user);

    if (!studentCanAccessExam(exam, studentClass)) {
      return fail("This exam is not available for your class.", 403);
    }

    const now = new Date();

    if (exam.startTime && exam.startTime > now) {
      return fail("Exam has not started yet.", 403);
    }

    if (exam.endTime && exam.endTime < now) {
      return fail("Exam has already ended.", 403);
    }

    const attemptCount = await Result.countDocuments({
      student: user.id,
      exam: parsed.examId,
    });

    if (attemptCount >= exam.attempts) {
      return fail("Maximum attempt limit reached.", 403);
    }

    const questions = await McqQuestion.find({ exam: parsed.examId })
      .select("+correctIndex")
      .sort({ order: 1 });

    const scoring = scoreMcqAttempt({
      questions,
      submittedAnswers: parsed.answers,
      negativeMarking: exam.negativeMarking,
      passMark: exam.passMark,
    });

    const result = await Result.create({
      student: user.id,
      exam: parsed.examId,
      answers: scoring.answers,
      score: scoring.score,
      percentage: scoring.percentage,
      isPassed: scoring.isPassed,
      timeTaken: parsed.timeTaken,
      attemptNo: attemptCount + 1,
      submittedAt: new Date(),
    });

    return success({
      result,
      totalMarks: scoring.totalMarks,
      solutions: questions.map((question) => ({
        questionId: String(question._id),
        correctIndex: question.correctIndex,
        explanation: question.explanation,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
