import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import type { QueryFilter } from "mongoose";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { PracticeQuestion, type IPracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { COURSE_TO_MCQ_SUBJECT_MAP, BENGALI_TO_ENGLISH_SUBJECT_MAP } from "@/lib/content/syllabus";

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
    const scope = searchParams.get("scope"); // "all" | "my-uploaded"

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

      // domain.subjects stores English names (e.g. "Physics") but `subject`
      // from the UI is the Bengali name (e.g. "পদার্থবিজ্ঞান").
      // Use COURSE_TO_MCQ_SUBJECT_MAP to check if ANY of the teacher's English
      // subjects maps to the requested Bengali subject.
      let subjectAllowed = false;
      if (domain?.subjects && domain.subjects.length > 0) {
        const mapping = COURSE_TO_MCQ_SUBJECT_MAP[level as "ssc" | "hsc"] || {};
        subjectAllowed = domain.subjects.some((engSub) => {
          const bengaliNames = mapping[engSub];
          return Array.isArray(bengaliNames) && bengaliNames.includes(subject);
        });
        // Fallback: also allow if stored subject name directly matches (Bengali stored directly)
        if (!subjectAllowed) {
          subjectAllowed = domain.subjects.includes(subject);
        }
      }

      if (levelAllowed && subjectAllowed) {
        allowed = true;
      }
    }

    if (!allowed) {
      return fail("Access denied to this subject/level", 403);
    }

    // Filter by scope
    const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;
    const query: QueryFilter<IPracticeQuestion> = {
      level,
      subject: { $in: [subject, englishSubject] },
      chapter,
    };

    if (scope === "my-uploaded") {
      query.createdBy = new mongoose.Types.ObjectId(String(user._id));
    } else {
      query.$or = [
        { isTeacherSet: { $ne: true } },
        { isTeacherSet: true, createdBy: new mongoose.Types.ObjectId(String(user._id)) }
      ];
    }

    // Fetch questions
    const questions = await PracticeQuestion.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return success({
      questions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID is required"),
});

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const sessionUser = await requireAuth(request, ["teacher"]);
    
    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const body = await request.json();
    const { ids } = bulkDeleteSchema.parse(body);

    // Only allow teachers to delete questions they created
    const result = await PracticeQuestion.deleteMany({
      _id: { $in: ids },
      createdBy: user._id,
    });

    // Also delete any reports related to these questions
    const { ReportedQuestion } = await import("@/lib/db/models/ReportedQuestion");
    await ReportedQuestion.deleteMany({ questionId: { $in: ids } });

    return success({
      message: `Successfully deleted ${result.deletedCount} questions.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
