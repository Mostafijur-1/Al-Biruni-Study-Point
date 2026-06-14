import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";

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
    const level = searchParams.get("level");
    const subject = searchParams.get("subject");
    const chapter = searchParams.get("chapter");

    if (!level || !subject || !chapter) {
      return fail("Missing required query parameters: level, subject, chapter", 400);
    }

    if (level !== "ssc" && level !== "hsc") {
      return fail("Invalid level parameter. Must be ssc or hsc.", 400);
    }

    // Verify teacher domain permission
    const domain = user.teacherDomain;
    let allowed = false;

    if (domain?.isAll) {
      allowed = true;
    } else {
      const allowedLevels: string[] = [];
      if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");

      const levelAllowed = allowedLevels.includes(level);
      const subjectAllowed = domain?.subjects?.includes(subject);
      if (levelAllowed && subjectAllowed) {
        allowed = true;
      }
    }

    if (!allowed) {
      return fail("Access denied to this subject/level", 403);
    }

    // Fetch questions
    const questions = await PracticeQuestion.find({ level, subject, chapter })
      .sort({ createdAt: -1 })
      .lean();

    return success({
      questions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
