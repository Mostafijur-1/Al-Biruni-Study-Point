import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { encourageClassmate } from "@/lib/community/service";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const encouragementSchema = z.object({
  memberId: z.string().regex(/^[a-f\d]{24}$/i),
  kind: z.enum(["high_five", "keep_going", "great_progress"]),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit(
      "student:peer-encouragement",
      user.id,
      { limit: 20, windowMs: 5 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = encouragementSchema.parse(await request.json());
    const result = await encourageClassmate({
      fromStudentId: user.id,
      toStudentId: parsed.memberId,
      studentClass,
      kind: parsed.kind,
    });
    if (!result.ok && result.reason === "self") {
      return fail("You cannot encourage yourself.", 400);
    }
    if (!result.ok) return fail("Classmate not found.", 404);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
