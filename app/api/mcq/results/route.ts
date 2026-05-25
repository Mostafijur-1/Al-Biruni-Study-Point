import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
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

    if (examId) {
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
