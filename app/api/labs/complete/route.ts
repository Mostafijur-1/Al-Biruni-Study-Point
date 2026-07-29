import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { completeScienceLab } from "@/lib/labs/service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const completionSchema = z.discriminatedUnion("labId", [
  z.object({
    labId: z.literal("motion"),
    values: z.object({
      velocity: z.number().int().min(2).max(20),
      time: z.number().int().min(1).max(10),
    }),
  }),
  z.object({
    labId: z.literal("circuit"),
    values: z.object({
      voltage: z.number().int().min(3).max(24),
      resistance: z.number().int().min(2).max(20),
    }),
  }),
  z.object({
    labId: z.literal("mole"),
    values: z.object({
      moles: z.number().min(0.5).max(5),
      molarMass: z.union([z.literal(18), z.literal(44), z.literal(58.5)]),
    }),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:science-lab-complete", user.id, {
      limit: 15,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = completionSchema.parse(await request.json());
    const result = await completeScienceLab({
      studentId: user.id,
      ...parsed,
    });
    if (!result.ok) {
      return fail("The experiment does not meet the mastery target yet.", 409);
    }
    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
