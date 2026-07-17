import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import type { StudentClass } from "@/types";

const createExamSchema = z.object({
  title: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  duration: z.number().int().min(1), // in minutes
  totalMarks: z.number().int().min(1),
  passMark: z.number().int().min(1),
  targetClasses: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);

    const exams = await McqExam.find({ teacher: user.id })
      .sort({ createdAt: -1 })
      .lean();

    const examIds = exams.map((e) => e._id);
    const questionCounts = await McqQuestion.aggregate([
      { $match: { exam: { $in: examIds } } },
      { $group: { _id: "$exam", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(questionCounts.map((qc) => [String(qc._id), qc.count]));

    const formattedExams = exams.map((e) => ({
      ...e,
      questionCount: countMap.get(String(e._id)) || 0,
    }));

    return success({ exams: formattedExams });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);

    const body = await request.json();
    const parsed = createExamSchema.parse(body);

    const exam = await McqExam.create({
      ...parsed,
      targetClasses: parsed.targetClasses as StudentClass[],
      teacher: user.id,
      isPublished: false,
      resultsPublished: false,
    });

    return success({ exam }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
