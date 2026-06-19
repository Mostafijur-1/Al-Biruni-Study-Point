import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { ReportedQuestion } from "@/lib/db/models/ReportedQuestion";

const editMcqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  options: z.array(z.string()).length(4, "Must have exactly 4 options"),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;
    const sessionUser = await requireAuth(request, ["teacher"]);
    
    // Retrieve full user to get teacherDomain
    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const question = await PracticeQuestion.findById(id);
    if (!question) {
      return fail("Question not found", 404);
    }

    // Verify teacher domain permission
    const domain = user.teacherDomain;
    let allowed = false;

    if (domain?.isAll) {
      allowed = true;
    } else {
      const allowedLevels: string[] = [];
      if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");

      const levelAllowed = allowedLevels.includes(question.level);
      const subjectAllowed = domain?.subjects?.includes(question.subject);
      if (levelAllowed && subjectAllowed) {
        allowed = true;
      }
    }

    if (!allowed) {
      return fail("Access denied to this question's subject/level", 403);
    }

    if (!question.isTeacherSet || String(question.createdBy) !== String(user._id)) {
      return fail("Access denied. You can only edit questions you created.", 403);
    }

    const body = await request.json();
    const parsed = editMcqSchema.parse(body);

    question.question = parsed.question;
    question.options = parsed.options;
    question.correctIndex = parsed.correctIndex;
    question.explanation = parsed.explanation;
    question.imageUrl = parsed.imageUrl || undefined;

    await question.save();

    // Auto-resolve any active reports for this question
    await ReportedQuestion.updateMany(
      { questionId: question._id, resolved: false },
      { $set: { resolved: true } }
    );

    return success({
      message: "Question updated successfully.",
      question,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;
    const sessionUser = await requireAuth(request, ["teacher"]);
    
    // Retrieve full user to get teacherDomain
    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const question = await PracticeQuestion.findById(id);
    if (!question) {
      return fail("Question not found", 404);
    }

    // Verify teacher domain permission
    const domain = user.teacherDomain;
    let allowed = false;

    if (domain?.isAll) {
      allowed = true;
    } else {
      const allowedLevels: string[] = [];
      if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");

      const levelAllowed = allowedLevels.includes(question.level);
      const subjectAllowed = domain?.subjects?.includes(question.subject);
      if (levelAllowed && subjectAllowed) {
        allowed = true;
      }
    }

    if (!allowed) {
      return fail("Access denied to this question's subject/level", 403);
    }

    if (!question.isTeacherSet || String(question.createdBy) !== String(user._id)) {
      return fail("Access denied. You can only delete questions you created.", 403);
    }

    await PracticeQuestion.deleteOne({ _id: id });

    // Also delete any reports related to this question
    await ReportedQuestion.deleteMany({ questionId: id });

    return success({
      message: "Question deleted successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
