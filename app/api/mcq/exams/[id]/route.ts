import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import {
  applyExamInput,
  computeTotalMarks,
  isPassMarkValid,
  replaceExamQuestions,
} from "@/lib/mcq/exam-service";
import {
  canReviewExam,
  sanitizeQuestionForStudent,
  shuffleQuestions,
  teacherOwnsExam,
} from "@/lib/mcq/exam-access";
import { updateMcqExamSchema } from "@/lib/validations/mcq.schema";

type McqExamDetailContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: McqExamDetailContext) {
  try {
    const user = await requireAuth(request, ["admin", "teacher", "student"]);
    const { id } = await context.params;

    const exam = await McqExam.findById(id).lean();

    if (!exam) {
      return fail("Exam not found.", 404);
    }

    const canReview = canReviewExam(user, exam);

    if (!exam.isPublished && !canReview) {
      return fail("Exam is not published.", 403);
    }

    const questionsQuery = McqQuestion.find({ exam: id }).sort({ order: 1 });

    if (canReview) {
      questionsQuery.select("+correctIndex");
    }

    const questions = await questionsQuery.lean();
    const visibleQuestions =
      exam.isRandomized && !canReview ? shuffleQuestions(questions) : questions;

    return success({
      exam,
      questions: visibleQuestions.map((question) =>
        canReview ? question : sanitizeQuestionForStudent(question),
      ),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: McqExamDetailContext) {
  try {
    const user = await requireAuth(request, ["admin", "teacher"]);
    const { id } = await context.params;
    const parsed = updateMcqExamSchema.parse(await request.json());

    const exam = await McqExam.findById(id);

    if (!exam) {
      return fail("Exam not found.", 404);
    }

    if (user.role === "teacher" && !teacherOwnsExam(user.id, exam.teacher)) {
      return fail("You can only edit your own exams.", 403);
    }

    const totalMarks = computeTotalMarks(parsed.questions);

    if (!isPassMarkValid(parsed.passMark, totalMarks)) {
      return fail("Pass mark cannot be greater than total marks.", 400);
    }

    applyExamInput(exam, parsed);
    await replaceExamQuestions(id, parsed.questions);
    await exam.save();

    return success({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}
