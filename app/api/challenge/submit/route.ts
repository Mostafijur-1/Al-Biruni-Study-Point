import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { submitDailyChallenge } from "@/lib/challenge/service";
import { connectDB } from "@/lib/db/connect";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const submitSchema = z.object({
  attemptId: z.string().regex(/^[a-f\d]{24}$/i),
  answers: z
    .array(
      z.object({
        questionId: z.string().regex(/^[a-f\d]{24}$/i),
        selectedIndex: z.number().int().min(0).max(3).nullable(),
      }),
    )
    .length(5),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit(
      "student:daily-challenge-submit",
      user.id,
      { limit: 10, windowMs: 5 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = submitSchema.parse(await request.json());
    const result = await submitDailyChallenge({
      studentId: user.id,
      attemptId: parsed.attemptId,
      answers: parsed.answers,
    });
    if (!result.ok && result.reason === "expired") {
      return fail("The challenge timer has ended.", 410);
    }
    if (!result.ok && result.reason === "questions") {
      return fail("The submitted challenge questions are invalid.", 400);
    }
    if (!result.ok) return fail("Challenge attempt not found.", 404);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
