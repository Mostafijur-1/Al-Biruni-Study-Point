import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { connectDB } from "@/lib/db/connect";
import { authorizeTeacherForStudentSubject } from "@/lib/auth/teacher-domain-policy";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await requireAuth(request, ["teacher", "admin"]);
    await context.params;
    return fail(
      "Deleting academic results is disabled. Use the void action with a reason.",
      405,
    );
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

    const attempt = await PracticeAttempt.findById(id);
    if (!attempt) {
      return fail("Practice attempt not found", 404);
    }

    if (user.role === "teacher") {
      const auth = await authorizeTeacherForStudentSubject(user.id, attempt.student.toString(), attempt.subject);
      if (!auth.ok) {
        return fail(auth.message, auth.status);
      }
    }

    attempt.teacherComment = teacherComment ?? "";
    attempt.commentedBy = new Types.ObjectId(user.id);
    await attempt.save();

    // Sync to PracticeResult (student dashboard summary)
    await PracticeResult.updateMany(
      { student: attempt.student, subject: attempt.subject },
      { 
        $set: { 
          teacherComment: teacherComment ?? "",
          commentedBy: user.id
        } 
      }
    );

    return success({ message: "Comment updated successfully.", attempt });
  } catch (error) {
    return handleApiError(error);
  }
}
