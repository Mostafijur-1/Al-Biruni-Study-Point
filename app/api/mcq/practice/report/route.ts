import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { ReportedQuestion } from "@/lib/db/models/ReportedQuestion";

const reportSchema = z.object({
  questionId: z.string(),
  comment: z.string().min(1, "Comment is required"),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);

    const body = await request.json();
    const parsed = reportSchema.parse(body);

    const report = await ReportedQuestion.create({
      questionId: parsed.questionId,
      studentId: user.id,
      comment: parsed.comment,
      resolved: false,
    });

    return success({
      message: "Report submitted successfully.",
      report,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
