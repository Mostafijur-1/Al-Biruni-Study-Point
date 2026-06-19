import { NextRequest } from "next/server";
import { z } from "zod";

import mongoose from "mongoose";

import { getSchoolLevel } from "@/lib/content/syllabus";
import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { loadFullQuestionById, scorePracticeAttempt } from "@/lib/mcq/practice-service";
import { connectDB } from "@/lib/db/connect";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { User } from "@/lib/db/models/User";
import { getPracticeSettings } from "@/lib/db/models/PracticeSettings";

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
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
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

    const isTeacher = parsed.mode === "teacher";
    
    // Resolve the student's teacher for this subject if in teacher mode
    let teacherId: string | undefined = undefined;
    if (isTeacher) {
      const studentIdObj = new mongoose.Types.ObjectId(user.id);
      const teacher = await User.findOne({
        role: "teacher",
        $or: [
          { "teacherDomain.isAll": true },
          {
            "teacherDomain.students": studentIdObj,
            "teacherDomain.subjects": parsed.subject
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
        } as any;
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
