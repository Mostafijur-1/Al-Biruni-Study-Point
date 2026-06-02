import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { connectDB } from "@/lib/db/connect";
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
  studentCanAccessExam,
  teacherOwnsExam,
} from "@/lib/mcq/exam-access";
import { requireStudentClass } from "@/lib/content/student-access";
import { updateMcqExamSchema } from "@/lib/validations/mcq.schema";

type McqExamDetailContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: McqExamDetailContext) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["admin", "teacher", "student"]);
    const { id } = await context.params;

    const examDoc = await McqExam.findById(id).lean();

    if (!examDoc) {
      return fail("Exam not found.", 404);
    }

    const exam = mapDocWithTargetClasses(examDoc);

    const canReview = canReviewExam(user, examDoc);

    if (!examDoc.isPublished && !canReview) {
      return fail("Exam is not published.", 403);
    }

    if (user.role === "student") {
      const studentClass = requireStudentClass(user);

      if (!studentCanAccessExam(examDoc, studentClass)) {
        return fail("This exam is not available for your class.", 403);
      }
    }

    const questionsQuery = McqQuestion.find({ exam: id }).sort({ order: 1 });

    if (canReview) {
      questionsQuery.select("+correctIndex");
    }

    const questions = await questionsQuery.lean();
    const visibleQuestions =
      examDoc.isRandomized && !canReview ? shuffleQuestions(questions) : questions;

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
    await connectDB();
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
    await McqExam.updateOne({ _id: id }, { $set: { targetClasses: parsed.targetClasses } });

    const saved = await McqExam.findById(id).lean();

    return success({
      exam: saved ? mapDocWithTargetClasses(saved) : mapDocWithTargetClasses(exam.toObject()),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
