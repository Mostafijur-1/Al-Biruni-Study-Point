import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connect";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";

type Context = {
  params: Promise<{ id: string }>;
};

const editMcqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  options: z.array(z.string()).length(4, "Must have exactly 4 options"),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  level: z.enum(["ssc", "hsc"]),
  subject: z.string().min(1),
  chapter: z.string().min(1),
});

export async function PUT(request: NextRequest, context: Context) {
  try {
    await requireAuth(request, ["admin"]);
    const { id } = await context.params;
    await connectDB();

    const question = await PracticeQuestion.findById(id);
    if (!question) {
      return fail("Question not found", 404);
    }

    const body = await request.json();
    const parsed = editMcqSchema.parse(body);

    question.question = parsed.question;
    question.options = parsed.options;
    question.correctIndex = parsed.correctIndex;
    question.explanation = parsed.explanation;
    question.imageUrl = parsed.imageUrl || undefined;
    question.level = parsed.level;
    question.subject = parsed.subject;
    question.chapter = parsed.chapter;

    await question.save();

    return success({
      message: "Question updated successfully.",
      question: {
        id: String(question._id),
        level: question.level,
        subject: question.subject,
        chapter: question.chapter,
        question: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation || "",
        imageUrl: question.imageUrl || "",
        createdAt: question.createdAt?.toISOString(),
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

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
