import { NextRequest } from "next/server";

import mongoose from "mongoose";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
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

    const mode = searchParams.get("mode") === "teacher" ? "teacher" : "general";
    let teacherId: string | undefined = undefined;

    if (mode === "teacher") {
      // Find the teacher of this student for this subject
      const studentIdObj = new mongoose.Types.ObjectId(user.id);
      const teacher = await User.findOne({
        role: "teacher",
        $or: [
          { "teacherDomain.isAll": true },
          {
            "teacherDomain.students": studentIdObj,
            "teacherDomain.subjects": subject
          }
        ]
      }).lean();
      if (!teacher) {
        return fail("You do not have a teacher assigned for this subject.", 400);
      }
      teacherId = String(teacher._id);
    }

    const examData = await startPracticeExam(
      subject,
      studentClass,
      selectedChapters,
      limit,
      settings.secondsPerQuestion,
      teacherId
    );

    return success({
      ...examData,
      passMarkPercent: settings.passMarkPercent,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
