import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User"; // Need to import User model for populate to find it
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { requireAuth } from "@/lib/auth/session";
import { handleApiError, success } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    await connectDB();

    // Ensure User model is loaded
    const _dummy = User.modelName;

    const questions = await PracticeQuestion.find({ isTeacherSet: true })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .lean();

    return success({
      questions: questions.map((q: any) => ({
        id: String(q._id),
        level: q.level,
        subject: q.subject,
        chapter: q.chapter,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || "",
        imageUrl: q.imageUrl || "",
        createdBy: q.createdBy ? { id: String(q.createdBy._id), name: q.createdBy.name } : null,
        createdAt: q.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
