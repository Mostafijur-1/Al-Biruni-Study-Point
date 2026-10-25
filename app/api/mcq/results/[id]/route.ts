import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import type { IMcqExam } from "@/lib/db/models/McqExam";
import "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { AttemptSession } from "@/lib/db/models/AttemptSession";
import { AssessmentAttempt } from "@/lib/db/models/AssessmentAttempt";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { canManageTeacherOwnedResource } from "@/lib/auth/resource-policy";

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
      if (user.role !== "student") {
        return fail("Exam attempt result not found.", 404);
      }

      const practiceResult = await PracticeResult.findOne({
        _id: id,
        student: user.id,
      })
        .populate("commentedBy", "name")
        .lean();

      if (!practiceResult) {
        return fail("Result not found.", 404);
      }

      const practiceAttempt = practiceResult.attemptSession
        ? await PracticeAttempt.findOne({
            attemptSession: practiceResult.attemptSession,
            student: user.id,
          }).lean()
        : null;

      if (!practiceAttempt) {
        return fail(
          "Detailed answers are unavailable for this older practice result.",
          404,
        );
      }

      return success({
        attempt: {
          _id: practiceResult._id.toString(),
          score: practiceResult.score,
          percentage: practiceResult.percentage,
          isPassed: practiceResult.isPassed,
          timeTaken: practiceResult.timeTaken,
          submittedAt: practiceResult.submittedAt,
          teacherComment: practiceResult.teacherComment,
          commentedBy: practiceResult.commentedBy,
          exam: {
            title: `${practiceResult.subject} MCQ Practice`,
            totalMarks: practiceResult.totalQuestions,
            passMark: Math.ceil(
              practiceResult.totalQuestions *
                ((practiceResult.passMarkPercent ?? 60) / 100),
            ),
          },
        },
        solutions: practiceAttempt.answers.map((answer, index) => ({
          id: String(answer.questionId || index),
          question: answer.question,
          options: answer.options,
          correctIndex: answer.correctIndex,
          explanation: answer.explanation || "",
          selectedIndex: answer.selectedIndex,
          isCorrect: answer.isCorrect,
        })),
      });
    }

    // Enforce privacy: only the student who took it, or a teacher/admin, can view details
    if (user.role === "student" && String(attempt.student._id) !== user.id) {
      return fail("You are not authorized to view this result.", 403);
    }

    const exam = attempt.exam as unknown as IMcqExam;

    if (
      user.role === "teacher" &&
      !canManageTeacherOwnedResource(user, exam.teacher)
    ) {
      return fail("Result not found or you do not have permission to view it.", 404);
    }

    // Enforce results publishing check for students
    if (user.role === "student" && !exam.resultsPublished) {
      return fail("Results for this exam have not been published by your teacher yet.", 403);
    }

    // Prefer the immutable submission snapshot. Legacy attempts fall back to live questions.
    const questions = attempt.questionSnapshots?.length
      ? attempt.questionSnapshots
      : await McqQuestion.find({ exam: exam._id }).sort({ order: 1 }).lean();

    // Map student answers for easy lookup in details view
    const answersMap = new Map(attempt.answers.map((a) => [String(a.questionId), a]));

    const solutionBreakdown = questions.map((q) => {
      const questionId = String("questionId" in q ? q.questionId : q._id);
      const studentAns = answersMap.get(questionId);
      return {
        id: questionId,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex, // safe to return now that results are published
        explanation: q.explanation || "",
        selectedIndex: studentAns?.selectedIndex ?? null,
        isCorrect: studentAns?.isCorrect ?? false,
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
          title: attempt.examSnapshot?.title ?? exam.title,
          totalMarks: attempt.examSnapshot?.totalMarks ?? attempt.totalMarksSnapshot ?? exam.totalMarks,
          passMark: attempt.examSnapshot?.passMark ?? attempt.passMarkSnapshot ?? exam.passMark,
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
    const exam = await attempt
      .populate("exam")
      .then((populatedAttempt) => populatedAttempt.exam as unknown as IMcqExam);
    if (!canManageTeacherOwnedResource(user, exam.teacher)) {
      return fail("You do not have permission to comment on this exam result.", 403);
    }

    attempt.teacherComment = teacherComment;
    attempt.commentedBy = new Types.ObjectId(user.id);
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

    const attempt = await McqExamAttempt.findById(id).populate("exam");
    if (!attempt) {
      return fail("Exam attempt not found.", 404);
    }

    const exam = attempt.exam as unknown as IMcqExam;
    if (!canManageTeacherOwnedResource(user, exam.teacher)) {
      return fail("You do not have permission to delete this student's result.", 403);
    }

    if (!attempt.isCancelled && !attempt.voidedAt) {
      return fail("Only cancelled exam attempts can be removed.", 400);
    }

    const studentId = attempt.student;
    const examId = exam._id;
    const attemptSessionId = attempt.attemptSession;
    const assessmentAttemptId = attempt.assessmentAttemptId;

    // 1. Delete the McqExamAttempt
    await McqExamAttempt.findByIdAndDelete(id);

    // 2. Delete linked AttemptSession(s) so student can restart the exam
    if (attemptSessionId) {
      await AttemptSession.findByIdAndDelete(attemptSessionId);
    }
    await AttemptSession.deleteMany({
      student: studentId,
      kind: "exam",
      exam: examId,
    });

    // 3. Delete linked AssessmentAttempt(s) if any
    if (assessmentAttemptId) {
      await AssessmentAttempt.findByIdAndDelete(assessmentAttemptId);
    }
    if (attemptSessionId) {
      await AssessmentAttempt.deleteMany({
        "legacySource.collection": "AttemptSession",
        "legacySource.id": String(attemptSessionId),
      });
    }

    // 4. Audit log
    await writeAuditLog({
      request,
      actor: user,
      action: "mcq-result.remove-cancelled",
      resourceType: "McqExamAttempt",
      resourceId: attempt._id,
      reason: "Teacher removed cancelled attempt to allow student re-attempt",
      before: {
        studentId: String(studentId),
        examId: String(examId),
        isCancelled: attempt.isCancelled,
        voidedAt: attempt.voidedAt ? attempt.voidedAt.toISOString() : null,
      },
    });

    return success({
      message: "Cancelled exam attempt removed successfully. The student can now attend the exam again.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
