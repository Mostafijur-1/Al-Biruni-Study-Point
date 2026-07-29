import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { claimWeeklyGoal } from "@/lib/goals/service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit("student:weekly-goal-claim", user.id, {
      limit: 10,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const result = await claimWeeklyGoal({
      studentId: user.id,
      studentClass,
    });
    if (!result.ok && result.reason === "not_found") {
      return fail("Create a weekly goal first.", 404);
    }
    if (!result.ok) {
      return fail("Complete your weekly goal before claiming the reward.", 409);
    }
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
