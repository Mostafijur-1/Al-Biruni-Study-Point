import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { connectDB } from "@/lib/db/connect";
import { McqQuestion } from "@/lib/db/models/McqQuestion";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "student", "teacher"]);
    await connectDB();

    const { searchParams } = request.nextUrl;

    if (user.role === "student") {
      const studentFields = "name";
      
      // 1. Fetch practice results (MCQ Tests)
      const practiceResults = await PracticeResult.find({ student: user.id })
        .populate("student", studentFields)
        .populate("commentedBy", "name")
        .sort({ submittedAt: -1 })
        .lean();

      const formattedPractice = practiceResults.map((pr) => ({
        _id: pr._id,
        student: pr.student,
        score: pr.score,
        percentage: pr.percentage,
        isPassed: pr.isPassed,
        timeTaken: pr.timeTaken,
        attemptNo: 1,
        submittedAt: pr.submittedAt,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        isPractice: true,
        subject: pr.subject,
        teacherComment: pr.teacherComment ?? "",
        commentedBy: pr.commentedBy,
        exam: {
          _id: `practice-${pr.subject}`,
          title: `${pr.subject} MCQ Test`,
          totalMarks: pr.totalQuestions,
          passMark: Math.ceil(pr.totalQuestions * 0.5),
          duration: pr.totalQuestions,
        },
      }));

      // 2. Fetch exam attempts where results have been published by the teacher
      const examAttempts = await McqExamAttempt.find({ student: user.id })
        .populate({
          path: "exam",
          match: { resultsPublished: true },
          populate: { path: "teacher", select: "name" },
        })
        .populate("commentedBy", "name")
        .sort({ submittedAt: -1 })
        .lean();

      // Filter out attempts where the exam results are not published (populated match is null)
      const publishedExamAttempts = examAttempts.filter((ea) => ea.exam != null);

      const formattedExams = publishedExamAttempts.map((ea: any) => ({
        _id: ea._id,
        student: { _id: user.id, name: user.name },
        score: ea.score,
        percentage: ea.percentage,
        isPassed: ea.isPassed,
        timeTaken: ea.timeTaken,
        attemptNo: ea.attemptNo || 1,
        submittedAt: ea.submittedAt,
        createdAt: ea.createdAt,
        updatedAt: ea.updatedAt,
        isPractice: false,
        subject: ea.exam.subject,
        teacherComment: ea.teacherComment ?? "",
        commentedBy: ea.commentedBy,
        exam: {
          _id: ea.exam._id.toString(),
          title: ea.exam.title,
          totalMarks: ea.exam.totalMarks,
          passMark: ea.exam.passMark,
          duration: ea.exam.duration,
        },
      }));

      const allResults = [...formattedPractice, ...formattedExams].sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      return success({ results: allResults });
    }

    if (user.role === "teacher" || user.role === "admin") {
      const examId = searchParams.get("examId");
      if (examId) {
        // Retrieve attempts for this specific exam
        const attempts = await McqExamAttempt.find({ exam: examId })
          .populate("student", "name phone studentClass schoolCollege")
          .populate("commentedBy", "name")
          .populate("exam")
          .sort({ submittedAt: -1 })
          .lean();

        // Load all questions for this exam once to map questions by ID
        const examQuestions = await McqQuestion.find({ exam: examId }).select("+correctIndex").lean();
        const questionMap = new Map(examQuestions.map((q) => [q._id.toString(), q]));

        const formatted = attempts.map((ea: any) => {
          const wrongAnswers = (ea.answers || [])
            .filter((ans: any) => !ans.isCorrect)
            .map((ans: any) => {
              const q = questionMap.get(ans.questionId.toString());
              return {
                question: q?.question ?? "Unknown Question",
                options: q?.options ?? ["", "", "", ""],
                selectedIndex: ans.selectedIndex,
                correctIndex: q?.correctIndex ?? 0,
                explanation: q?.explanation ?? null,
              };
            });

          return {
            _id: ea._id.toString(),
            student: ea.student,
            score: ea.score,
            percentage: ea.percentage,
            isPassed: ea.isPassed,
            timeTaken: ea.timeTaken,
            attemptNo: ea.attemptNo || 1,
            submittedAt: ea.submittedAt,
            teacherComment: ea.teacherComment ?? "",
            commentedBy: ea.commentedBy,
            wrongAnswers,
            exam: {
              _id: ea.exam._id.toString(),
              title: ea.exam.title,
              totalMarks: ea.exam.totalMarks,
              passMark: ea.exam.passMark,
              duration: ea.exam.duration,
            },
          };
        });
        return success({ results: formatted });
      }
    }

    return success({ results: [] });
  } catch (error) {
    return handleApiError(error);
  }
}
