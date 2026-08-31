import { NextRequest } from "next/server";

import mongoose from "mongoose";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { AttemptSession } from "@/lib/db/models/AttemptSession";
import { User } from "@/lib/db/models/User";
import {
  beginAttemptSession,
  createAttemptSession,
  getRemainingSeconds,
  saveAttemptDraft,
} from "@/lib/mcq/attempt-session";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const { id } = await context.params;

    const exam = await McqExam.findById(id).lean();
    if (!exam || !exam.isPublished || exam.isArchived) {
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

    let attemptSession = await AttemptSession.findOne({
      student: user.id,
      kind: "exam",
      exam: id,
      status: { $in: ["ready", "started"] },
    }).sort({ createdAt: -1 });

    let questions;
    if (attemptSession) {
      const storedQuestions = await McqQuestion.find({
        _id: { $in: attemptSession.questionIds },
        exam: id,
      }).lean();
      const questionMap = new Map(storedQuestions.map((question) => [String(question._id), question]));
      questions = attemptSession.questionIds
        .map((questionId) => questionMap.get(String(questionId)))
        .filter((question): question is NonNullable<typeof question> => Boolean(question));
    } else {
      questions = await McqQuestion.find({ exam: id })
        .sort({ order: 1 })
        .lean();
      attemptSession = await createAttemptSession({
        studentId: user.id,
        kind: "exam",
        examId: id,
        questionIds: questions.map((question) => question._id.toString()),
        durationSeconds: exam.duration * 60,
        organizationId: exam.organizationId ? String(exam.organizationId) : undefined,
        assessmentId: exam.assessmentId ? String(exam.assessmentId) : undefined,
        assessmentVersionId: exam.assessmentVersionId ? String(exam.assessmentVersionId) : undefined,
        questionVersionIds: exam.assessmentVersionId && questions.every((question) => question.questionVersionId)
          ? questions.map((question) => String(question.questionVersionId))
          : undefined,
      });
    }

    if (attemptSession && !attemptSession.assessmentVersionId && exam.organizationId && exam.assessmentId && exam.assessmentVersionId && questions.every((question) => question.questionVersionId)) {
      attemptSession.organizationId = exam.organizationId;
      attemptSession.assessmentId = exam.assessmentId;
      attemptSession.assessmentVersionId = exam.assessmentVersionId;
      attemptSession.questionVersionIds = questions.map((question) => question.questionVersionId!);
      await attemptSession.save();
    }

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
        totalMarks: exam.publishedTotalMarks ?? exam.totalMarks,
        passMark: exam.passMark,
        questionCount: sanitizedQuestions.length,
      },
      questions: sanitizedQuestions,
      attemptSession: {
        id: attemptSession._id.toString(),
        status: attemptSession.status,
        remainingSeconds: getRemainingSeconds(attemptSession),
        startedAt: attemptSession.startedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const beginSchema = z.object({
  attemptSessionId: z.string().min(1),
});

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const { id } = await context.params;
    const parsed = beginSchema.parse(await request.json());
    const session = await beginAttemptSession(parsed.attemptSessionId, user.id, "exam");

    if (!session || String(session.exam) !== id) {
      return fail("Exam attempt session is invalid or no longer available.", 400);
    }

    return success({
      attemptSessionId: session._id.toString(),
      remainingSeconds: getRemainingSeconds(session),
      startedAt: session.startedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const autosaveSchema = z.object({
  attemptSessionId: z.string().min(1),
  revision: z.number().int().min(0),
  responses: z.array(z.object({ questionId: z.string().min(1), selectedIndex: z.number().int().min(0).max(3).nullable() })).max(500),
});

export async function PUT(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const { id } = await context.params;
    const parsed = autosaveSchema.parse(await request.json());
    const session = await AttemptSession.findOne({ _id: parsed.attemptSessionId, student: user.id, exam: id }).select("_id").lean();
    if (!session) return fail("Exam attempt session is invalid.", 400);
    const saved = await saveAttemptDraft({ sessionId: parsed.attemptSessionId, studentId: user.id, kind: "exam", expectedRevision: parsed.revision, responses: parsed.responses });
    if (!saved.ok) return fail(saved.reason === "conflict" ? "A newer answer draft already exists." : "Exam answer draft is invalid.", saved.reason === "conflict" ? 409 : 400);
    return success(saved);
  } catch (error) {
    return handleApiError(error);
  }
}
