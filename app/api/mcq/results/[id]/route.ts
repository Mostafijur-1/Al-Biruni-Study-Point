import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { Result } from "@/lib/db/models/Result";
import { McqExam } from "@/lib/db/models/McqExam";
import { connectDB } from "@/lib/db/connect";

type Context = {
  params: Promise<{ id: string }>;
};

async function checkAuthorization(userId: string, userRole: string, examId: string) {
  if (userRole === "admin") {
    return { authorized: true };
  }

  const exam = await McqExam.findById(examId).lean();
  if (!exam) {
    return { authorized: false, error: fail("Exam not found", 404) };
  }

  if (exam.teacher.toString() !== userId) {
    return { authorized: false, error: fail("You are not authorised to modify results for this exam.", 403) };
  }

  return { authorized: true };
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher", "admin"]);
    const { id } = await context.params;

    const resultDoc = await Result.findById(id);
    if (!resultDoc) {
      return fail("Result not found", 404);
    }

    const auth = await checkAuthorization(user.id, user.role, resultDoc.exam.toString());
    if (!auth.authorized) {
      return auth.error!;
    }

    resultDoc.deletedByTeacher = true;
    await resultDoc.save();

    return success({ message: "Exam result deleted from teacher view successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher", "admin"]);
    const { id } = await context.params;
    const { teacherComment } = await request.json();

    const resultDoc = await Result.findById(id);
    if (!resultDoc) {
      return fail("Result not found", 404);
    }

    const auth = await checkAuthorization(user.id, user.role, resultDoc.exam.toString());
    if (!auth.authorized) {
      return auth.error!;
    }

    resultDoc.teacherComment = teacherComment ?? "";
    resultDoc.commentedBy = user.id as any;
    await resultDoc.save();

    return success({ message: "Comment updated successfully.", result: resultDoc });
  } catch (error) {
    return handleApiError(error);
  }
}
