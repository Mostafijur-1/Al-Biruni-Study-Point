import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";

// Prevent tree-shaking of McqExam model
const _ = McqExam;

const commentSchema = z.object({
  teacherComment: z.string().trim().default(""),
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student", "teacher", "admin"]);
    const { id } = await context.params;

    const attempt = await McqExamAttempt.findById(id)
      .populate("exam")
      .populate("student", "name email")
      .populate("commentedBy", "name")
      .lean();

    if (!attempt) {
      return fail("Exam attempt result not found.", 404);
    }

    // Enforce privacy: only the student who took it, or a teacher/admin, can view details
    if (user.role === "student" && String(attempt.student._id) !== user.id) {
      return fail("You are not authorized to view this result.", 403);
    }

    const exam = attempt.exam as any;

    // Enforce results publishing check for students
    if (user.role === "student" && !exam.resultsPublished) {
      return fail("Results for this exam have not been published by your teacher yet.", 403);
    }

    // Load full solutions (McqQuestions)
    const questions = await McqQuestion.find({ exam: exam._id })
      .sort({ order: 1 })
      .lean();

    // Map student answers for easy lookup in details view
    const answersMap = new Map(attempt.answers.map((a) => [String(a.questionId), a]));

    const solutionBreakdown = questions.map((q) => {
      const studentAns = answersMap.get(String(q._id));
      return {
        id: q._id.toString(),
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex, // safe to return now that results are published
        explanation: q.explanation || "",
        selectedIndex: studentAns ? studentAns.selectedIndex : null,
        isCorrect: studentAns ? studentAns.isCorrect : false,
      };
    });

    return success({
      attempt: {
        _id: attempt._id.toString(),
        score: attempt.score,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        timeTaken: attempt.timeTaken,
        submittedAt: attempt.submittedAt,
        teacherComment: attempt.teacherComment,
        commentedBy: attempt.commentedBy,
        exam: {
          title: exam.title,
          totalMarks: exam.totalMarks,
          passMark: exam.passMark,
        },
      },
      solutions: solutionBreakdown,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher", "admin"]);
    const { id } = await context.params;

    const body = await request.json();
    const { teacherComment } = commentSchema.parse(body);

    const attempt = await McqExamAttempt.findById(id);
    if (!attempt) {
      return fail("Attempt not found.", 404);
    }

    // Verify teacher owns the exam linked to this attempt
    const exam = await attempt.populate("exam").then((a) => a.exam as any);
    if (user.role === "teacher" && String(exam.teacher) !== user.id) {
      return fail("You do not have permission to comment on this exam result.", 403);
    }

    attempt.teacherComment = teacherComment;
    attempt.commentedBy = user.id as any;
    await attempt.save();

    return success({ message: "Comment saved successfully.", attempt });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher", "admin"]);
    const { id } = await context.params;

    const attempt = await McqExamAttempt.findById(id);
    if (!attempt) {
      return fail("Attempt not found.", 404);
    }

    // Verify teacher owns the exam
    const exam = await attempt.populate("exam").then((a) => a.exam as any);
    if (user.role === "teacher" && String(exam.teacher) !== user.id) {
      return fail("You do not have permission to delete this student's result.", 403);
    }

    await McqExamAttempt.findByIdAndDelete(id);

    return success({ message: "Exam result deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
