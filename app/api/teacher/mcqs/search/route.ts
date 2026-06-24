import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { COURSE_TO_MCQ_SUBJECT_MAP } from "@/lib/content/syllabus";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const sessionUser = await requireAuth(request, ["teacher"]);
    
    // Retrieve full user to get teacherDomain
    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return success({ questions: [] });
    }

    // Verify teacher domain permission & filter query
    const domain = user.teacherDomain;
    let queryConditions: any = {
      question: { $regex: query, $options: "i" },
    };

    if (!domain?.isAll) {
      const allowedLevels: string[] = [];
      if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");

      const allowedSubjects: string[] = [];
      if (domain?.subjects) {
        // Map English subjects to Bengali equivalents for allowed levels
        for (const lvl of allowedLevels) {
          const mapping = COURSE_TO_MCQ_SUBJECT_MAP[lvl as "ssc" | "hsc"] || {};
          for (const engSub of domain.subjects) {
            const bengaliNames = mapping[engSub];
            if (Array.isArray(bengaliNames)) {
              allowedSubjects.push(...bengaliNames);
            }
          }
        }
        // Fallback: also include the original subjects directly
        allowedSubjects.push(...domain.subjects);
      }

      queryConditions.level = { $in: allowedLevels };
      queryConditions.subject = { $in: allowedSubjects };
    }

    // Fetch questions
    const questions = await PracticeQuestion.find(queryConditions)
      .limit(50)
      .lean();

    return success({
      questions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
