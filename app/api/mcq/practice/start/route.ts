import { NextRequest } from "next/server";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { startPracticeExam } from "@/lib/mcq/practice-service";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);

    const { searchParams } = request.nextUrl;
    const subject = searchParams.get("subject");
    const chaptersParam = searchParams.get("chapters");

    if (!subject) {
      return fail("Subject parameter is required.", 400);
    }

    const selectedChapters = chaptersParam
      ? chaptersParam.split(",").map((c) => decodeURIComponent(c.trim()))
      : undefined;

    const examData = await startPracticeExam(subject, studentClass, selectedChapters);

    return success(examData);
  } catch (error: any) {
    return handleApiError(error);
  }
}
