import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";

const updateExamSchema = z.object({
  title: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  duration: z.number().int().min(1),
  totalMarks: z.number().int().min(1),
  passMark: z.number().int().min(1),
  targetClasses: z.array(z.string()).default([]),
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const exam = await McqExam.findOne({ _id: id, teacher: user.id }).lean();
    if (!exam) {
      return fail("Exam not found or you do not have permission to access it.", 404);
    }

    const questions = await McqQuestion.find({ exam: id })
      .sort({ order: 1 })
      .lean();

    return success({ exam, questions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const body = await request.json();
    const parsed = updateExamSchema.parse(body);

    const exam = await McqExam.findOneAndUpdate(
      { _id: id, teacher: user.id },
      { $set: parsed },
      { new: true }
    );

    if (!exam) {
      return fail("Exam not found or you do not have permission to update it.", 404);
    }

    return success({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const exam = await McqExam.findOneAndDelete({ _id: id, teacher: user.id });
    if (!exam) {
      return fail("Exam not found or you do not have permission to delete it.", 404);
    }

    // Delete questions and attempts linked to this exam
    await McqQuestion.deleteMany({ exam: id });
    await McqExamAttempt.deleteMany({ exam: id });

    return success({ message: "Exam and all associated questions and results deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
