import { NextRequest } from "next/server";
import { z } from "zod";

import mongoose from "mongoose";

import { getSchoolLevel, COURSE_TO_MCQ_SUBJECT_MAP } from "@/lib/content/syllabus";
import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { loadFullQuestionById, scorePracticeAttempt } from "@/lib/mcq/practice-service";
import { connectDB } from "@/lib/db/connect";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { User } from "@/lib/db/models/User";
import { getPracticeSettings } from "@/lib/db/models/PracticeSettings";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const submitPracticeSchema = z.object({
  subject: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().int().min(0).max(3).nullable(),
    }),
  ),
  timeTaken: z.number().min(0),
  mode: z.enum(["general", "teacher"]).optional(),
  isCancelled: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:practice-submit", user.id, {
      limit: 20,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const studentClass = requireStudentClass(user);

    const parsed = submitPracticeSchema.parse(await request.json());

    // Fetch admin-configurable pass mark
    const settings = await getPracticeSettings();

    const scoring = await scorePracticeAttempt(
      parsed.subject,
      studentClass,
      parsed.answers,
      settings.passMarkPercent
    );
    if (scoring.invalidQuestionIds.length > 0) {
      return fail("The submission contains invalid questions for this subject or class.", 400);
    }

    const isTeacher = parsed.mode === "teacher";
    
    // Resolve the student's teacher for this subject if in teacher mode
    let teacherId: string | undefined = undefined;
    if (isTeacher) {
      const studentIdObj = new mongoose.Types.ObjectId(user.id);

      // Map Bengali subject to English equivalents for database query
      const isHsc = studentClass === "class-11" || studentClass === "class-12";
      const levelKey = isHsc ? "hsc" : "ssc";
      const mapping = COURSE_TO_MCQ_SUBJECT_MAP[levelKey] || {};
      const englishSubjects: string[] = [];
      for (const engSub in mapping) {
        if (mapping[engSub].includes(parsed.subject)) {
          englishSubjects.push(engSub);
        }
      }
      englishSubjects.push(parsed.subject);

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
      if (teacher) {
        teacherId = String(teacher._id);
      }
    }

    // Delete any previous practice results for this subject, student and mode
    await PracticeResult.deleteMany({
      student: user.id,
      subject: parsed.subject,
      isTeacherSet: isTeacher ? true : { $ne: true },
    });

    // Build detailed answer records (including question text and options)
    const level = getSchoolLevel(studentClass);
    const detailedAnswers = await Promise.all(
      scoring.solutions.map(async (sol) => {
        const studentAns = parsed.answers.find((a) => a.questionId === sol.questionId);
        const full = await loadFullQuestionById(level, parsed.subject, sol.questionId);
        const selectedIndex = studentAns?.selectedIndex ?? null;
        return {
          questionId: sol.questionId,
          question: full?.question ?? "",
          options: full?.options ?? [],
          selectedIndex,
          isCorrect: selectedIndex !== null && selectedIndex === sol.correctIndex,
          correctIndex: sol.correctIndex,
          explanation: sol.explanation,
          imageUrl: full?.imageUrl,
        };
      })
    );

    // Save detailed attempt (teacher view)
    await PracticeAttempt.create({
      student: user.id,
      subject: parsed.subject,
      answers: detailedAnswers,
      totalQuestions: scoring.totalQuestions,
      score: scoring.score,
      percentage: scoring.percentage,
      isPassed: scoring.isPassed,
      timeTaken: parsed.timeTaken,
      isTeacherSet: isTeacher,
      teacherId: teacherId || undefined,
      isCancelled: parsed.isCancelled || false,
    });

    // Save only the summary result (existing behavior)
    const result = await PracticeResult.create({
      student: user.id,
      subject: parsed.subject,
      score: scoring.score,
      totalQuestions: scoring.totalQuestions,
      percentage: scoring.percentage,
      isPassed: scoring.isPassed,
      timeTaken: parsed.timeTaken,
      submittedAt: new Date(),
      isTeacherSet: isTeacher,
      teacherId: teacherId || undefined,
      isCancelled: parsed.isCancelled || false,
    });

    return success({
      result,
      totalQuestions: scoring.totalQuestions,
      solutions: scoring.solutions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
