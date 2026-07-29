import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { MistakeReview } from "@/lib/db/models/MistakeReview";
import {
  getCanonicalSubjectName,
  getSubjectAliases,
  getUniqueSubjectNames,
} from "@/lib/content/syllabus";
import {
  backfillMistakesForStudent,
  recordMistakeReviewAnswer,
} from "@/lib/learning/mistake-service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const reviewAnswerSchema = z.object({
  mistakeId: z.string().min(1),
  selectedIndex: z.number().int().min(0).max(3),
});

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    await backfillMistakesForStudent(user.id);

    const status =
      request.nextUrl.searchParams.get("status") === "mastered"
        ? "mastered"
        : "active";
    const subject = request.nextUrl.searchParams.get("subject");
    const dueOnly = request.nextUrl.searchParams.get("due") === "1";
    const parsedLimit = Number(request.nextUrl.searchParams.get("limit") || 50);
    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 50),
    );
    const now = new Date();

    const query: Record<string, unknown> = {
      student: user.id,
      status,
    };
    if (subject) query.subject = { $in: getSubjectAliases(subject) };
    if (dueOnly) query.nextReviewAt = { $lte: now };

    const [mistakes, activeCount, dueCount, masteredCount, subjects] =
      await Promise.all([
        MistakeReview.find(query)
          .sort({ nextReviewAt: 1, lastWrongAt: -1 })
          .limit(limit)
          .lean(),
        MistakeReview.countDocuments({ student: user.id, status: "active" }),
        MistakeReview.countDocuments({
          student: user.id,
          status: "active",
          nextReviewAt: { $lte: now },
        }),
        MistakeReview.countDocuments({ student: user.id, status: "mastered" }),
        MistakeReview.distinct("subject", { student: user.id }),
      ]);

    return success({
      mistakes: mistakes.map((mistake) => ({
        id: String(mistake._id),
        subject: getCanonicalSubjectName(mistake.subject),
        chapter: mistake.chapter,
        question: mistake.questionText,
        options: mistake.options,
        imageUrl: mistake.imageUrl,
        wrongCount: mistake.wrongCount,
        reviewCount: mistake.reviewCount,
        correctStreak: mistake.correctStreak,
        status: mistake.status,
        nextReviewAt: mistake.nextReviewAt,
        lastWrongAt: mistake.lastWrongAt,
      })),
      summary: {
        active: activeCount,
        due: dueCount,
        mastered: masteredCount,
      },
      subjects: getUniqueSubjectNames(subjects).sort((a, b) =>
        a.localeCompare(b, "bn"),
      ),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:mistake-review", user.id, {
      limit: 120,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const parsed = reviewAnswerSchema.parse(await request.json());
    const result = await recordMistakeReviewAnswer({
      studentId: user.id,
      mistakeId: parsed.mistakeId,
      selectedIndex: parsed.selectedIndex,
    });
    if (!result) return fail("ভুলের খাতায় প্রশ্নটি পাওয়া যায়নি।", 404);

    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
