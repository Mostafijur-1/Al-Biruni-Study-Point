import { NextRequest } from "next/server";
import { z } from "zod";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { scorePracticeAttempt } from "@/lib/mcq/practice-service";

const submitPracticeSchema = z.object({
  subject: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().min(0).max(3),
    })
  ),
  timeTaken: z.number().min(0),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);

    const parsed = submitPracticeSchema.parse(await request.json());

    const scoring = await scorePracticeAttempt(parsed.subject, studentClass, parsed.answers);

    // Delete any previous practice results for this subject and student
    await PracticeResult.deleteMany({
      student: user.id,
      subject: parsed.subject,
    });

    // Save only the summary result
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
