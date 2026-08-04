import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { User } from "@/lib/db/models/User";
import { isExamWithinTeacherDomain } from "@/lib/auth/teacher-domain-rules";

const updateExamSchema = z.object({
  title: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  duration: z.number().int().min(1),
  totalMarks: z.number().int().min(1),
  passMark: z.number().int().min(1),
  targetClasses: z.array(z.enum(["class-9", "class-10", "class-11", "class-12"])).min(1),
}).refine((exam) => exam.passMark <= exam.totalMarks, {
  message: "Pass mark cannot exceed total marks.",
  path: ["passMark"],
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;

    const exam = await McqExam.findOne({
      _id: id,
      teacher: user.id,
      isArchived: { $ne: true },
    }).lean();
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
    const teacher = await User.findById(user.id).select("teacherDomain").lean();
    if (!isExamWithinTeacherDomain(teacher?.teacherDomain, parsed.subject, parsed.targetClasses)) {
      return fail("The selected subject or class is outside your assigned teaching scope.", 403);
    }

    const existingExam = await McqExam.findOne({
      _id: id,
      teacher: user.id,
      isArchived: { $ne: true },
    });
    if (!existingExam) {
      return fail("Exam not found or you do not have permission to update it.", 404);
    }
    if (existingExam.isPublished || existingExam.publishedAt || (existingExam.version ?? 0) > 0) {
      return fail("A published exam is immutable. Archive it and create a new exam version.", 409);
    }

    existingExam.set(parsed);
    const exam = await existingExam.save();

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
    await requireAuth(request, ["teacher"]);
    await context.params;
    return fail("Deleting exams is disabled. Use the archive action with a reason.", 405);
  } catch (error) {
    return handleApiError(error);
  }
}
