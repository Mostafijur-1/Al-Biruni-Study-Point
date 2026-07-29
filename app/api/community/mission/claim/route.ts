import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { claimClassMissionReward } from "@/lib/community/service";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit(
      "student:class-mission-claim",
      user.id,
      { limit: 10, windowMs: 5 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const result = await claimClassMissionReward({
      studentId: user.id,
      studentClass,
    });
    if (!result.ok && result.reason === "incomplete") {
      return fail("The class mission is not complete yet.", 409);
    }
    if (!result.ok) {
      return fail(
        "Answer at least 10 questions this week to claim the shared reward.",
        409,
      );
    }
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
