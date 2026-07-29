import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import {
  createWeeklyGoal,
  getWeeklyGoalBoard,
} from "@/lib/goals/service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const createSchema = z.object({
  metric: z.enum([
    "practice_questions",
    "focus_minutes",
    "challenge_days",
  ]),
  target: z.number().int().positive(),
  subject: z.string().trim().min(1).max(80).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    return success(
      await getWeeklyGoalBoard({
        studentId: user.id,
        studentClass,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit("student:weekly-goal-create", user.id, {
      limit: 8,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = createSchema.parse(await request.json());
    const result = await createWeeklyGoal({
      studentId: user.id,
      studentClass,
      ...parsed,
    });
    if (!result.ok && result.reason === "target") {
      return fail("Selected goal target is not available.", 400);
    }
    if (!result.ok) return fail("Selected subject is not available.", 400);
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
