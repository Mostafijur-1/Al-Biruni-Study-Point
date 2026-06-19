import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireAuth(request, ["admin"]);
    const { id } = await context.params;
    await connectDB();

    const question = await PracticeQuestion.findById(id);
    if (!question) {
      return fail("Question not found", 404);
    }

    // Approve the question and add to general pool
    question.isTeacherSet = false;
    question.approvedByAdmin = true;
    await question.save();

    return success({ message: "Question approved and added to general MCQ pool successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await requireAuth(request, ["admin"]);
    const { id } = await context.params;
    await connectDB();

    const question = await PracticeQuestion.findByIdAndDelete(id);
    if (!question) {
      return fail("Question not found", 404);
    }

    return success({ message: "Question deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
