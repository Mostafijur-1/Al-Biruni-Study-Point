import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { McqExam } from "@/lib/db/models/McqExam";
import { Result } from "@/lib/db/models/Result";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "student", "teacher"]);
    const { searchParams } = request.nextUrl;
    const examId = searchParams.get("examId");

    const query: Record<string, unknown> = {};

    if (user.role === "student") {
      query.student = user.id;
    }

    if (user.role === "teacher") {
      const ownedExams = await McqExam.find({ teacher: user.id }).select("_id").lean();
      const ownedExamIds = ownedExams.map((exam) => exam._id);

      if (examId) {
        const ownsExam = ownedExamIds.some((id) => String(id) === examId);
        if (!ownsExam) {
          return fail("You can only view results for your own exams.", 403);
        }
        query.exam = examId;
      } else {
        query.exam = { $in: ownedExamIds };
      }
    } else if (examId) {
      query.exam = examId;
    }

    const studentFields = user.role === "admin" ? "name phone" : "name";

    const results = await Result.find(query)
      .populate("exam", "title totalMarks passMark duration")
      .populate("student", studentFields)
      .sort({ submittedAt: -1 })
      .limit(user.role === "admin" ? 200 : 50)
      .lean();

    if (user.role === "student" && !examId) {
      const { PracticeResult } = await import("@/lib/db/models/PracticeResult");
      const practiceResults = await PracticeResult.find({ student: user.id })
        .populate("student", studentFields)
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
        exam: {
          _id: `practice-${pr.subject}`,
          title: `${pr.subject} MCQ Test`,
          totalMarks: pr.totalQuestions,
          passMark: Math.ceil(pr.totalQuestions * 0.5),
          duration: pr.totalQuestions,
        },
      }));

      const combined = [...results, ...formattedPractice];
      combined.sort(
        (a: any, b: any) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      return success({ results: combined.slice(0, 50) });
    }

    return success({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
