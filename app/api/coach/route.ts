import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import {
  createStudyCoachCheckIn,
  getStudyCoachStatus,
} from "@/lib/coach/service";
import { connectDB } from "@/lib/db/connect";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const checkInSchema = z.object({
  availableMinutes: z.union([
    z.literal(5),
    z.literal(15),
    z.literal(30),
    z.literal(45),
  ]),
  energy: z.enum(["low", "steady", "high"]),
  intent: z.enum(["auto", "revise", "practice", "focus", "explore"]),
});

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    return success(
      await getStudyCoachStatus({
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
    const rateLimit = await consumeRateLimit("student:coach-check-in", user.id, {
      limit: 12,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = checkInSchema.parse(await request.json());
    return success(
      await createStudyCoachCheckIn({
        studentId: user.id,
        studentClass,
        ...parsed,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
