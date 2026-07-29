import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { claimQuestReward } from "@/lib/gamification/quest-service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const claimSchema = z.object({
  questCode: z.string().min(1).max(60),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:quest-claim", user.id, {
      limit: 20,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = claimSchema.parse(await request.json());
    const result = await claimQuestReward({
      studentId: user.id,
      questCode: parsed.questCode,
    });
    if (!result.ok && result.reason === "not_found") {
      return fail("Quest not found.", 404);
    }
    if (!result.ok) {
      return fail("Complete this quest before claiming its reward.", 409);
    }
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
