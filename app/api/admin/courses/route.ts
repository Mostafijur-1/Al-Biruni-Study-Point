import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { connectDB } from "@/lib/db/connect";
import { Course } from "@/lib/db/models/Course";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
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

    // 1. Fetch practice question counts per (level, subject) in a single aggregation query
    const practiceCounts = await PracticeQuestion.aggregate([
      { $group: { _id: { level: "$level", subject: "$subject" }, count: { $sum: 1 } } },
    ]);
    const practiceCountMap = new Map(
      practiceCounts.map((item) => [
        `${item._id.level.toLowerCase()}:${item._id.subject.toLowerCase()}`,
        item.count,
      ])
    );

    // 2. Fetch student counts per class in a single aggregation query
    const studentClassCounts = await User.aggregate([
      { $match: { role: "student" } },
      { $group: { _id: "$studentClass", count: { $sum: 1 } } },
    ]);
    const classCountMap = new Map(studentClassCounts.map((c) => [c._id, c.count]));

    const enriched = courses.map((course) => {
      const examCount = practiceCountMap.get(`${course.level.toLowerCase()}:${course.subject.toLowerCase()}`) || 0;
      
      const studentCount = (course.targetClasses || []).reduce(
        (sum: number, cls: string) => sum + (classCountMap.get(cls) || 0),
        0
      );

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
    });

    return success({ courses: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}
