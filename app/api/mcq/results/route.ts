import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { connectDB } from "@/lib/db/connect";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "student", "teacher"]);
    await connectDB();

    if (user.role === "student") {
      const studentFields = "name";
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

      return success({ results: formattedPractice });
    }

    return success({ results: [] });
  } catch (error) {
    return handleApiError(error);
  }
}
