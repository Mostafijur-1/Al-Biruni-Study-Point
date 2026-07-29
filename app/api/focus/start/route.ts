import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { startFocusSession } from "@/lib/focus/service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const startSchema = z.object({
  subject: z.string().trim().min(1).max(80),
  intention: z.enum(["practice", "review", "lesson", "assignment"]),
  durationMinutes: z.union([z.literal(15), z.literal(25), z.literal(45)]),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit(
      "student:focus-start",
      user.id,
      { limit: 12, windowMs: 5 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = startSchema.parse(await request.json());
    const result = await startFocusSession({
      studentId: user.id,
      studentClass,
      ...parsed,
    });
    if (!result.ok) return fail("Selected subject is not available.", 400);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
