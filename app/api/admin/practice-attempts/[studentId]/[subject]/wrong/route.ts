import { NextRequest } from "next/server";
import { fail, success, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";

export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string; subject: string }> }) {
  try {
    await connectDB();
    await requireAuth(request, ["admin"]);
    const { studentId, subject } = await params;

    // Find the latest attempt for this student and subject
    const attempt = await PracticeAttempt.findOne({
      student: studentId,
      subject,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!attempt) return fail("No practice attempts found for this student/subject.", 404);

    const wrongAnswers = attempt.answers
      .filter((a) => !a.isCorrect)
      .map((a) => ({
        questionId: a.questionId,
        question: a.question,
        options: a.options,
        selectedIndex: a.selectedIndex,
        correctIndex: a.correctIndex,
        explanation: a.explanation,
      }));

    return success({ wrongAnswers, totalWrong: wrongAnswers.length });
  } catch (error) {
    return handleApiError(error);
  }
}
