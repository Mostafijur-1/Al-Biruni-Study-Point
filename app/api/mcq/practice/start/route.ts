import { NextRequest } from "next/server";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { getPracticeSettings } from "@/lib/db/models/PracticeSettings";
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

    // Fetch admin-configurable settings
    const settings = await getPracticeSettings();

    const limitParam = searchParams.get("limit");
    let limit = settings.maxQuestionsPerTest;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if ([10, 15, 20, 25].includes(parsedLimit)) {
        limit = parsedLimit;
      }
    }

    const examData = await startPracticeExam(
      subject,
      studentClass,
      selectedChapters,
      limit,
      settings.secondsPerQuestion
    );

    return success({
      ...examData,
      passMarkPercent: settings.passMarkPercent,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
