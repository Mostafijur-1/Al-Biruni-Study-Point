import { NextRequest } from "next/server";
import { Types } from "mongoose";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { updateMcqExamSchema } from "@/lib/validations/mcq.schema";

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

export async function PATCH(request: NextRequest, context: McqExamDetailContext) {
  try {
    const user = await requireAuth(request, ["admin", "teacher"]);
    const { id } = await context.params;
    const parsed = updateMcqExamSchema.parse(await request.json());

    await connectDB();

    const exam = await McqExam.findById(id);

    if (!exam) {
      return fail("Exam not found.", 404);
    }

    if (user.role === "teacher" && String(exam.teacher) !== user.id) {
      return fail("You can only edit your own exams.", 403);
    }

    const totalMarks = parsed.questions.reduce((sum, question) => sum + question.marks, 0);

    if (parsed.passMark > totalMarks) {
      return fail("Pass mark cannot be greater than total marks.", 400);
    }

    exam.title = parsed.title;
    exam.course = parsed.courseId ? new Types.ObjectId(parsed.courseId) : undefined;
    exam.duration = parsed.duration;
    exam.totalMarks = totalMarks;
    exam.passMark = parsed.passMark;
    exam.negativeMarking = parsed.negativeMarking;
    exam.isRandomized = parsed.isRandomized;
    exam.isPublished = parsed.isPublished;
    exam.startTime = parsed.startTime ? new Date(parsed.startTime) : undefined;
    exam.endTime = parsed.endTime ? new Date(parsed.endTime) : undefined;
    exam.attempts = parsed.attempts;
    exam.questionCount = parsed.questions.length;

    await McqQuestion.deleteMany({ exam: id });
    await McqQuestion.insertMany(
      parsed.questions.map((question, index) => ({
        exam: id,
        question: question.question,
        questionBn: question.questionBn || undefined,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation || undefined,
        marks: question.marks,
        difficulty: question.difficulty,
        topic: question.topic || undefined,
        order: index,
      })),
    );

    await exam.save();

    return success({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}
