import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { getPracticeSettings, PracticeSettings } from "@/lib/db/models/PracticeSettings";

const SettingsSchema = z.object({
  maxQuestionsPerTest: z.number().int().min(1).max(100),
  secondsPerQuestion: z.number().int().min(10).max(300),
  passMarkPercent: z.number().min(1).max(100),
});

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    await requireAuth(request, ["admin"]);
    const settings = await getPracticeSettings();
    return success({
      maxQuestionsPerTest: settings.maxQuestionsPerTest,
      secondsPerQuestion: settings.secondsPerQuestion,
      passMarkPercent: settings.passMarkPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    await requireAuth(request, ["admin"]);

    const body = await request.json();
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid settings values. Check ranges and types.", 400);
    }

    const existing = await PracticeSettings.findOne();
    if (existing) {
      existing.maxQuestionsPerTest = parsed.data.maxQuestionsPerTest;
      existing.secondsPerQuestion = parsed.data.secondsPerQuestion;
      existing.passMarkPercent = parsed.data.passMarkPercent;
      await existing.save();
    } else {
      await PracticeSettings.create(parsed.data);
    }

    return success({ message: "Settings saved successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
