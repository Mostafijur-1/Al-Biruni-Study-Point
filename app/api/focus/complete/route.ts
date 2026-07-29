import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { completeFocusSession } from "@/lib/focus/service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const completeSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i),
  reflection: z.enum(["energized", "steady", "challenging"]),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit(
      "student:focus-complete",
      user.id,
      { limit: 12, windowMs: 5 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = completeSchema.parse(await request.json());
    const result = await completeFocusSession({
      studentId: user.id,
      sessionId: parsed.sessionId,
      reflection: parsed.reflection,
    });
    if (!result.ok && result.reason === "early") {
      return fail("The focus timer is still running.", 409);
    }
    if (!result.ok && result.reason === "expired") {
      return fail("This focus session is too old to complete.", 410);
    }
    if (!result.ok && result.reason === "inactive") {
      return fail("This focus session is no longer active.", 409);
    }
    if (!result.ok) return fail("Focus session not found.", 404);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
