import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { SYLLABUS } from "@/lib/content/syllabus";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const sessionUser = await requireAuth(request, ["teacher"]);
    
    // Retrieve full user to get teacherDomain
    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const domain = user.teacherDomain;
    const allowedLevels: ("ssc" | "hsc")[] = [];

    if (domain?.isAll) {
      allowedLevels.push("ssc", "hsc");
    } else {
      if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");
    }

    const subjectsWithChapters: { level: "ssc" | "hsc"; subject: string; chapters: string[] }[] = [];

    for (const lvl of allowedLevels) {
      const lvlSubjects = SYLLABUS[lvl];
      for (const subjectName in lvlSubjects) {
        const hasAccess = domain?.isAll || domain?.subjects?.includes(subjectName);
        if (hasAccess) {
          subjectsWithChapters.push({
            level: lvl,
            subject: subjectName,
            chapters: lvlSubjects[subjectName as keyof typeof lvlSubjects] || [],
          });
        }
      }
    }

    return success({
      subjects: subjectsWithChapters,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
