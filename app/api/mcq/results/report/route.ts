import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { ReportedQuestion } from "@/lib/db/models/ReportedQuestion";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

const reportSchema = z.object({
  attemptId: objectIdSchema,
  questionId: objectIdSchema,
  issueType: z.enum([
    "wrong-answer",
    "unclear-question",
    "option-problem",
    "explanation-problem",
    "other",
  ]),
  comment: z.string().trim().max(500).optional().default(""),
});

const issueLabels = {
  "wrong-answer": "সঠিক উত্তর নিয়ে সমস্যা",
  "unclear-question": "প্রশ্নটি অস্পষ্ট",
  "option-problem": "অপশনে সমস্যা",
  "explanation-problem": "ব্যাখ্যায় সমস্যা",
  other: "অন্যান্য সমস্যা",
} as const;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["student"]);
    const parsed = reportSchema.parse(await request.json());

    await connectDB();
    const rateLimit = await consumeRateLimit("student:result-question-report", user.id, {
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const examAttempt = await McqExamAttempt.findOne({
      _id: parsed.attemptId,
      student: user.id,
    }).lean();

    let sourceType: "practice" | "exam";
    let sourceOwnerId: string | undefined;
    let sourceTitle: string;
    let snapshot: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation?: string;
    };

    if (examAttempt) {
      const question = await McqQuestion.findOne({
        _id: parsed.questionId,
        exam: examAttempt.exam,
      })
        .populate("exam", "title teacher")
        .lean();

      if (!question) return fail("প্রশ্নটি এই Exam-এর অন্তর্ভুক্ত নয়।", 404);

      const exam = question.exam as unknown as {
        title?: string;
        teacher?: { toString(): string };
      };
      sourceType = "exam";
      sourceOwnerId = exam.teacher?.toString();
      sourceTitle = exam.title || "MCQ Exam";
      snapshot = {
        question: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
      };
    } else {
      const result = await PracticeResult.findOne({
        _id: parsed.attemptId,
        student: user.id,
      }).lean();
      if (!result?.attemptSession) return fail("Practice-এর ফলাফল পাওয়া যায়নি।", 404);

      const attempt = await PracticeAttempt.findOne({
        attemptSession: result.attemptSession,
        student: user.id,
      }).lean();
      const answer = attempt?.answers.find(
        (item) => String(item.questionId) === parsed.questionId,
      );
      if (!answer) return fail("প্রশ্নটি এই Practice-এর অন্তর্ভুক্ত নয়।", 404);

      sourceType = "practice";
      sourceOwnerId = attempt?.teacherId?.toString();
      sourceTitle = `${result.subject} MCQ Practice`;
      snapshot = {
        question: answer.question,
        options: answer.options,
        correctIndex: answer.correctIndex,
        explanation: answer.explanation,
      };
    }

    const comment = parsed.comment
      ? `${issueLabels[parsed.issueType]} — ${parsed.comment}`
      : issueLabels[parsed.issueType];
    const report = await ReportedQuestion.findOneAndUpdate(
      {
        questionId: parsed.questionId,
        studentId: user.id,
        resolved: false,
      },
      {
        $set: {
          comment,
          sourceType,
          sourceOwnerId,
          sourceTitle,
          questionSnapshot: snapshot,
        },
        $setOnInsert: {
          questionId: parsed.questionId,
          studentId: user.id,
          resolved: false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return success({
      message: "Report Submit হয়েছে।",
      reportId: report._id.toString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
