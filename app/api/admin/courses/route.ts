import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { connectDB } from "@/lib/db/connect";
import { Course } from "@/lib/db/models/Course";
import { McqExam } from "@/lib/db/models/McqExam";
import { User } from "@/lib/db/models/User";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    await connectDB();

    const courses = await Course.find()
      .populate("teacher", "name email phone isActive approvalStatus")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const enriched = await Promise.all(
      courses.map(async (course) => {
        const [studentCount, examCount] = await Promise.all([
          User.countDocuments({
            role: "student",
            studentClass: { $in: course.targetClasses },
          }),
          McqExam.countDocuments({ course: course._id }),
        ]);

        const teacher = course.teacher as {
          _id: unknown;
          name?: string;
          email?: string;
          phone?: string;
          isActive?: boolean;
          approvalStatus?: string;
        } | null;

        return {
          ...mapDocWithTargetClasses(course),
          teacher: teacher
            ? {
                id: String(teacher._id),
                name: teacher.name,
                email: teacher.email,
                phone: teacher.phone,
                isActive: teacher.isActive,
                approvalStatus: teacher.approvalStatus,
              }
            : null,
          studentCount,
          examCount,
        };
      }),
    );

    return success({ courses: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}
