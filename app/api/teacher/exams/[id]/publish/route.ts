import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam, type IMcqExam } from "@/lib/db/models/McqExam";

const togglePublishSchema = z.object({
  type: z.enum(["exam", "results"]),
  value: z.boolean(),
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const body = await request.json();
    const parsed = togglePublishSchema.parse(body);

    const updateObj: Partial<Pick<IMcqExam, "isPublished" | "resultsPublished">> = {};
    if (parsed.type === "exam") {
      updateObj.isPublished = parsed.value;
    } else {
      updateObj.resultsPublished = parsed.value;
    }

    const exam = await McqExam.findOneAndUpdate(
      { _id: id, teacher: user.id },
      { $set: updateObj },
      { new: true }
    );

    if (!exam) {
      return fail("Exam not found or you do not have permission to modify it.", 404);
    }

    return success({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}
