import { NextRequest } from "next/server";

import mongoose from "mongoose";
import { z } from "zod";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { getPracticeSettings } from "@/lib/db/models/PracticeSettings";
import { startPracticeExam } from "@/lib/mcq/practice-service";
import {
  beginAttemptSession,
  createAttemptSession,
  getRemainingSeconds,
} from "@/lib/mcq/attempt-session";
import { COURSE_TO_MCQ_SUBJECT_MAP, getSchoolLevel, getSyllabusChapters } from "@/lib/content/syllabus";

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

    const level = getSchoolLevel(studentClass);
    const syllabusChapters = getSyllabusChapters(level, subject);

    const selectedChapters = chaptersParam
      ? (chaptersParam.includes("|||")
        ? chaptersParam.split("|||").map((c) => decodeURIComponent(c.trim()))
        : (syllabusChapters.includes(decodeURIComponent(chaptersParam.trim()))
          ? [decodeURIComponent(chaptersParam.trim())]
          : chaptersParam.split(",").map((c) => decodeURIComponent(c.trim()))))
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

      // Map Bengali subject to English equivalents for database query
      const isHsc = studentClass === "class-11" || studentClass === "class-12";
      const levelKey = isHsc ? "hsc" : "ssc";
      const mapping = COURSE_TO_MCQ_SUBJECT_MAP[levelKey] || {};
      const englishSubjects: string[] = [];
      for (const engSub in mapping) {
        if (mapping[engSub].includes(subject)) {
          englishSubjects.push(engSub);
        }
      }
      englishSubjects.push(subject);

      const teacher = await User.findOne({
        role: "teacher",
        $or: [
          { "teacherDomain.isAll": true },
          {
            "teacherDomain.students": studentIdObj,
            "teacherDomain.subjects": { $in: englishSubjects }
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
    const attemptSession = await createAttemptSession({
      studentId: user.id,
      kind: "practice",
      subject,
      questionIds: examData.questions.map((question) => question.id),
      durationSeconds: examData.durationSeconds,
    });

    return success({
      ...examData,
      attemptSessionId: attemptSession._id.toString(),
      passMarkPercent: settings.passMarkPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const beginSchema = z.object({
  attemptSessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const parsed = beginSchema.parse(await request.json());
    const session = await beginAttemptSession(
      parsed.attemptSessionId,
      user.id,
      "practice",
    );

    if (!session) {
      return fail("Practice attempt session is invalid or no longer available.", 400);
    }

    return success({
      attemptSessionId: session._id.toString(),
      remainingSeconds: getRemainingSeconds(session),
      startedAt: session.startedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
