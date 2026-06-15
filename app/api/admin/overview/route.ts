import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Course } from "@/lib/db/models/Course";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { User } from "@/lib/db/models/User";
import { AppInstall } from "@/lib/db/models/AppInstall";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    await connectDB();

    const [
      studentsTotal,
      studentsActive,
      teachersTotal,
      teachersActive,
      teachersPending,
      coursesTotal,
      coursesPublished,
      practiceQuestionsTotal,
      practiceQuestionsSSC,
      practiceQuestionsHSC,
      practiceAttemptsTotal,
      practiceAttemptsPassed,
      uniqueDevicesCount,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "student", isActive: true }),
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "teacher", isActive: true, approvalStatus: "approved" }),
      User.countDocuments({ role: "teacher", approvalStatus: "pending" }),
      Course.countDocuments(),
      Course.countDocuments({ status: "published" }),
      PracticeQuestion.countDocuments(),
      PracticeQuestion.countDocuments({ level: "ssc" }),
      PracticeQuestion.countDocuments({ level: "hsc" }),
      PracticeAttempt.countDocuments(),
      PracticeAttempt.countDocuments({ isPassed: true }),
      AppInstall.aggregate([
        { $group: { _id: "$deviceId" } },
        { $count: "count" },
      ]),
    ]);

    const appInstallsTotal = uniqueDevicesCount[0]?.count || 0;

    return success({
      stats: {
        studentsTotal,
        studentsActive,
        teachersTotal,
        teachersActive,
        teachersPending,
        coursesTotal,
        coursesPublished,
        practiceQuestionsTotal,
        practiceQuestionsSSC,
        practiceQuestionsHSC,
        practiceAttemptsTotal,
        practiceAttemptsPassed,
        appInstallsTotal,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

