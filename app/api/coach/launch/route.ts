import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { launchStudyCoachRecommendation } from "@/lib/coach/service";
import { connectDB } from "@/lib/db/connect";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const launchSchema = z.object({
  checkInId: z.string().regex(/^[a-f\d]{24}$/i),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:coach-launch", user.id, {
      limit: 20,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = launchSchema.parse(await request.json());
    const result = await launchStudyCoachRecommendation({
      studentId: user.id,
      checkInId: parsed.checkInId,
    });
    if (!result) return fail("Study Coach check-in not found.", 404);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
