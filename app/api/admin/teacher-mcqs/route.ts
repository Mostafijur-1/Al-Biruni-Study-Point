import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import type { QueryFilter, Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import "@/lib/db/models/User";
import { PracticeQuestion, type IPracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { requireAuth } from "@/lib/auth/session";
import { fail, handleApiError, success } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await requireAuth(request, ["admin"]);
    await connectDB();

    const { searchParams } = request.nextUrl;
    const level = searchParams.get("level");
    const subject = searchParams.get("subject");
    const chapter = searchParams.get("chapter");
    const teacherId = searchParams.get("teacherId");
    const scope = searchParams.get("scope"); // "me" | "teachers" | "all"

    const query: QueryFilter<IPracticeQuestion> = { isTeacherSet: true };

    if (level) {
      if (level !== "ssc" && level !== "hsc") {
        return fail("level must be ssc or hsc.", 400);
      }
      query.level = level;
    }
    if (subject) {
      const { BENGALI_TO_ENGLISH_SUBJECT_MAP } = await import("@/lib/content/syllabus");
      const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;
      query.subject = { $in: [subject, englishSubject] };
    }
    if (chapter) query.chapter = chapter;

    if (scope === "me") {
      query.createdBy = new mongoose.Types.ObjectId(sessionUser.id);
    } else if (scope === "teachers") {
      query.createdBy = { $ne: new mongoose.Types.ObjectId(sessionUser.id) };
    } else if (teacherId) {
      query.createdBy = new mongoose.Types.ObjectId(teacherId);
    }

    type PopulatedQuestion = IPracticeQuestion & {
      _id: Types.ObjectId;
      createdBy?: { _id: Types.ObjectId; name: string };
    };

    const questions = await PracticeQuestion.find(query)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .lean<PopulatedQuestion[]>();

    return success({
      questions: questions.map((q) => ({
        id: String(q._id),
        level: q.level,
        subject: q.subject,
        chapter: q.chapter,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || "",
        imageUrl: q.imageUrl || "",
        createdBy: q.createdBy ? { id: String(q.createdBy._id), name: q.createdBy.name } : null,
        createdAt: q.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const bulkApproveSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID is required"),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    await connectDB();

    const body = await request.json();
    const { ids } = bulkApproveSchema.parse(body);

    const result = await PracticeQuestion.updateMany(
      { _id: { $in: ids }, isTeacherSet: true },
      { $set: { isTeacherSet: false, approvedByAdmin: true } }
    );

    return success({
      message: `Successfully approved ${result.modifiedCount} questions.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID is required"),
});

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth(request, ["admin"]);
    await connectDB();

    const body = await request.json();
    const { ids } = bulkDeleteSchema.parse(body);

    const result = await PracticeQuestion.deleteMany({
      _id: { $in: ids },
      isTeacherSet: true,
    });

    // Also delete any reports related to these questions
    const { ReportedQuestion } = await import("@/lib/db/models/ReportedQuestion");
    await ReportedQuestion.deleteMany({ questionId: { $in: ids } });

    return success({
      message: `Successfully deleted ${result.deletedCount} questions.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
