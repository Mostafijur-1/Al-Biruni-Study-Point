import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { classFilterForStudent } from "@/lib/content/classes";
import { parseGuestClassParam } from "@/lib/content/guest-scope";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { Result } from "@/lib/db/models/Result";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    await connectDB();

    const { searchParams } = request.nextUrl;
    const classParam = searchParams.get("class");
    const query: Record<string, unknown> = {};

    const guestClass = parseGuestClassParam(classParam);

    if (guestClass) {
      Object.assign(query, classFilterForStudent(guestClass));
    }

    const exams = await McqExam.find(query)
      .populate("teacher", "name email phone")
      .populate("course", "title slug")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const examIds = exams.map((exam) => exam._id);
    const attemptCounts = await Result.aggregate([
      { $match: { exam: { $in: examIds } } },
      { $group: { _id: "$exam", count: { $sum: 1 } } },
    ]);
    const attemptCountMap = new Map(attemptCounts.map((c) => [c._id.toString(), c.count]));

    const enriched = exams.map((exam) => {
      const attemptCount = attemptCountMap.get(exam._id.toString()) || 0;

      const teacher = exam.teacher as {
        _id: unknown;
        name?: string;
        email?: string;
        phone?: string;
      } | null;

      const course = exam.course as {
        _id: unknown;
        title?: string;
        slug?: string;
      } | null;

      return {
        ...mapDocWithTargetClasses(exam),
        _id: String(exam._id),
        teacher: teacher
          ? {
              id: String(teacher._id),
              name: teacher.name,
              email: teacher.email,
              phone: teacher.phone,
            }
          : null,
        course: course
          ? {
              id: String(course._id),
              title: course.title,
              slug: course.slug,
            }
          : null,
        attemptCount,
      };
    });

    return success({ exams: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}
