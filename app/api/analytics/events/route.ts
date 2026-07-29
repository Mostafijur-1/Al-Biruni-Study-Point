import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import {
  ProductEvent,
  STUDENT_EVENT_NAMES,
} from "@/lib/db/models/ProductEvent";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const propertyValueSchema = z.union([
  z.string().max(160),
  z.number().finite(),
  z.boolean(),
]);

const eventSchema = z.object({
  name: z.enum(STUDENT_EVENT_NAMES),
  surface: z.string().trim().min(1).max(60),
  properties: z
    .record(z.string().trim().min(1).max(50), propertyValueSchema)
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["student"]);
    const parsed = eventSchema.parse(await request.json());

    await connectDB();
    const rateLimit = await consumeRateLimit("student:analytics", user.id, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    await ProductEvent.create({
      user: user.id,
      name: parsed.name,
      surface: parsed.surface,
      properties: parsed.properties ?? {},
    });

    return success({ recorded: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
