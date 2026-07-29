import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { cancelFocusSession } from "@/lib/focus/service";
import { connectDB } from "@/lib/db/connect";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const cancelSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit(
      "student:focus-cancel",
      user.id,
      { limit: 12, windowMs: 5 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = cancelSchema.parse(await request.json());
    const result = await cancelFocusSession({
      studentId: user.id,
      sessionId: parsed.sessionId,
    });
    if (!result.ok && result.reason === "inactive") {
      return fail("This focus session is no longer active.", 409);
    }
    if (!result.ok) return fail("Focus session not found.", 404);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
