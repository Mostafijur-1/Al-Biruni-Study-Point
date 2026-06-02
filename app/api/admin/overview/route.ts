import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Course } from "@/lib/db/models/Course";
import { McqExam } from "@/lib/db/models/McqExam";
import { Result } from "@/lib/db/models/Result";
import { User } from "@/lib/db/models/User";

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
      examsTotal,
      examsPublished,
      resultsTotal,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "student", isActive: true }),
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "teacher", isActive: true, approvalStatus: "approved" }),
      User.countDocuments({ role: "teacher", approvalStatus: "pending" }),
      Course.countDocuments(),
      Course.countDocuments({ status: "published" }),
      McqExam.countDocuments(),
      McqExam.countDocuments({ isPublished: true }),
      Result.countDocuments(),
    ]);

    return success({
      stats: {
        studentsTotal,
        studentsActive,
        teachersTotal,
        teachersActive,
        teachersPending,
        coursesTotal,
        coursesPublished,
        examsTotal,
        examsPublished,
        resultsTotal,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
