import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import {
  buildQuestionDocuments,
  computeTotalMarks,
  createExamPayload,
  isPassMarkValid,
} from "@/lib/mcq/exam-service";
import { createMcqExamSchema } from "@/lib/validations/mcq.schema";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const courseId = searchParams.get("courseId");
    const published = searchParams.get("published");

    const query: Record<string, unknown> = {};

    if (courseId) {
      query.course = courseId;
    }

    if (published === "false") {
      const user = await requireAuth(request, ["admin", "teacher"]);

      if (user.role === "teacher") {
        query.teacher = user.id;
      }
    } else {
      query.isPublished = true;
    }

    const exams = await McqExam.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return success({ exams });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher"]);
    const parsed = createMcqExamSchema.parse(await request.json());

    const totalMarks = computeTotalMarks(parsed.questions);

    if (!isPassMarkValid(parsed.passMark, totalMarks)) {
      return fail("Pass mark cannot be greater than total marks.", 400);
    }

    const exam = await McqExam.create(createExamPayload(parsed, user.id));

    await McqQuestion.insertMany(buildQuestionDocuments(exam._id, parsed.questions));

    return success({ exam }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
