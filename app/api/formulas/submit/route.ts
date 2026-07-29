import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { submitFormulaSprint } from "@/lib/formulas/service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const submitSchema = z.object({
  attemptId: z.string().regex(/^[a-f\d]{24}$/i),
  answers: z
    .array(
      z.object({
        cardId: z.string().trim().min(1).max(80),
        confidence: z.enum(["again", "good", "easy"]),
      }),
    )
    .length(5),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:formula-sprint-submit", user.id, {
      limit: 10,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = submitSchema.parse(await request.json());
    const result = await submitFormulaSprint({
      studentId: user.id,
      ...parsed,
    });
    if (!result.ok && result.reason === "answers") {
      return fail("Submit one confidence rating for every sprint card.", 400);
    }
    if (!result.ok) return fail("Formula sprint not found.", 404);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
