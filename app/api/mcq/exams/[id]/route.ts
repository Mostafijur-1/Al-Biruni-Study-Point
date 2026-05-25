import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";

type McqExamDetailContext = {
  params: Promise<{ id: string }>;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export async function GET(request: NextRequest, context: McqExamDetailContext) {
  try {
    const user = await requireAuth(request, ["admin", "teacher", "student"]);
    const { id } = await context.params;

    await connectDB();

    const exam = await McqExam.findById(id).lean();

    if (!exam) {
      return fail("Exam not found.", 404);
    }

    const isOwner = String(exam.teacher) === user.id;
    const canReview = user.role === "admin" || (user.role === "teacher" && isOwner);

    if (!exam.isPublished && !canReview) {
      return fail("Exam is not published.", 403);
    }

    const questionsQuery = McqQuestion.find({ exam: id }).sort({ order: 1 });

    if (canReview) {
      questionsQuery.select("+correctIndex");
    }

    const questions = await questionsQuery.lean();
    const visibleQuestions = exam.isRandomized && !canReview ? shuffle(questions) : questions;

    return success({
      exam,
      questions: visibleQuestions.map((question) => {
        if (canReview) {
          return question;
        }

        return {
          _id: question._id,
          exam: question.exam,
          question: question.question,
          questionBn: question.questionBn,
          options: question.options,
          marks: question.marks,
          difficulty: question.difficulty,
          topic: question.topic,
          order: question.order,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
