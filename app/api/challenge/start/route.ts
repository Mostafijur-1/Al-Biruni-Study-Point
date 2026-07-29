import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { startDailyChallenge } from "@/lib/challenge/service";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit(
      "student:daily-challenge-start",
      user.id,
      { limit: 10, windowMs: 5 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const result = await startDailyChallenge({
      studentId: user.id,
      studentClass,
    });
    if (!result.ok && result.reason === "completed") {
      return fail("Today's challenge is already complete.", 409);
    }
    if (!result.ok && result.reason === "expired") {
      return fail("Today's challenge attempt has expired.", 410);
    }
    if (!result.ok) {
      return fail("Today's challenge is not available yet.", 503);
    }
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
