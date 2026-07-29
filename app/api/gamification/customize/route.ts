import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import {
  HUB_THEMES,
  PROFILE_FRAMES,
} from "@/lib/gamification/engagement-rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const customizeSchema = z
  .object({
    frame: z.string().min(1).max(30).optional(),
    theme: z.string().min(1).max(30).optional(),
  })
  .refine((value) => value.frame || value.theme, {
    message: "Choose a frame or theme.",
  });

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:game-customize", user.id, {
      limit: 30,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const parsed = customizeSchema.parse(await request.json());
    const profile = await getOrCreateGameProfile(user.id);
    const frame = parsed.frame
      ? PROFILE_FRAMES.find((item) => item.id === parsed.frame)
      : undefined;
    const theme = parsed.theme
      ? HUB_THEMES.find((item) => item.id === parsed.theme)
      : undefined;

    if ((parsed.frame && !frame) || (parsed.theme && !theme)) {
      return fail("Reward not found.", 404);
    }
    if (
      (frame && profile.level < frame.requiredLevel) ||
      (theme && profile.level < theme.requiredLevel)
    ) {
      return fail("Reach the required level to unlock this reward.", 403);
    }

    const selections: { selectedFrame?: string; selectedTheme?: string } = {};
    if (frame) selections.selectedFrame = frame.id;
    if (theme) selections.selectedTheme = theme.id;
    const updated = await StudentGameProfile.findOneAndUpdate(
      { student: user.id },
      { $set: selections },
      { new: true },
    );
    if (!updated) return fail("Game profile not found.", 404);
    return success({
      selectedFrame: updated.selectedFrame,
      selectedTheme: updated.selectedTheme,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
