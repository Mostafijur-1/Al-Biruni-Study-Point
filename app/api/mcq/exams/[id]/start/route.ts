import { NextRequest } from "next/server";

import mongoose from "mongoose";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { User } from "@/lib/db/models/User";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const { id } = await context.params;

    const exam = await McqExam.findById(id).lean();
    if (!exam || !exam.isPublished) {
      return fail("Exam not found or not published.", 404);
    }

    const studentClass = user.studentClass || "class-9";
    if (!exam.targetClasses.includes(studentClass)) {
      return fail("This exam is not available for your class.", 403);
    }

    // Verify student is assigned to this teacher
    const studentIdObj = new mongoose.Types.ObjectId(user.id);
    const isAssigned = await User.findOne({
      _id: exam.teacher,
      role: "teacher",
      $or: [
        { "teacherDomain.students": studentIdObj },
        { "teacherDomain.isAll": true }
      ]
    }).lean();

    if (!isAssigned) {
      return fail("You are not authorized to take this teacher's exam.", 403);
    }

    // Enforce single-attempt check
    const existingAttempt = await McqExamAttempt.findOne({
      student: user.id,
      exam: id,
    }).lean();

    if (existingAttempt) {
      return fail("You have already completed this exam.", 400);
    }

    // Retrieve questions and sanitize them for the runner
    const questions = await McqQuestion.find({ exam: id })
      .sort({ order: 1 })
      .lean();

    const sanitizedQuestions = questions.map((q) => ({
      id: q._id.toString(),
      question: q.question,
      options: q.options,
    }));

    return success({
      exam: {
        _id: exam._id.toString(),
        title: exam.title,
        duration: exam.duration, // in minutes
        totalMarks: exam.totalMarks,
        passMark: exam.passMark,
        questionCount: sanitizedQuestions.length,
      },
      questions: sanitizedQuestions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
