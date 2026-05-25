import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { Result } from "@/lib/db/models/Result";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "student", "teacher"]);
    const { searchParams } = request.nextUrl;
    const examId = searchParams.get("examId");

    await connectDB();

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

    const results = await Result.find(query)
      .populate("exam", "title totalMarks passMark duration")
      .populate("student", "name phone")
      .sort({ submittedAt: -1 })
      .limit(50)
      .lean();

    return success({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
