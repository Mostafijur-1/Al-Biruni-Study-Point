import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { completeScienceLab } from "@/lib/labs/service";
import {
  SCIENCE_LAB_IDS,
  type ScienceLabId,
} from "@/lib/labs/rules";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const completionSchema = z.object({
  labId: z.enum(SCIENCE_LAB_IDS),
  values: z.record(z.string(), z.number().finite()).refine(
    (values) => Object.keys(values).length <= 8,
    "Too many experiment values.",
  ),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit("student:science-lab-complete", user.id, {
      limit: 15,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = completionSchema.parse(await request.json());
    const result = await completeScienceLab({
      studentId: user.id,
      studentClass,
      labId: parsed.labId as ScienceLabId,
      values: parsed.values,
    });
    if (!result.ok) {
      return fail("The experiment does not meet the mastery target yet.", 409);
    }
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
