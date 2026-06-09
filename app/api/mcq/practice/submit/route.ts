import { NextRequest } from "next/server";
import { z } from "zod";

import { getSchoolLevel } from "@/lib/content/syllabus";
import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { loadFullQuestionById, scorePracticeAttempt } from "@/lib/mcq/practice-service";
import { connectDB } from "@/lib/db/connect";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
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

    // Delete any previous practice results for this subject and student
    await PracticeResult.deleteMany({
      student: user.id,
      subject: parsed.subject,
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
