import { NextRequest } from "next/server";

import mongoose from "mongoose";
import { z } from "zod";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { getPracticeSettings } from "@/lib/db/models/PracticeSettings";
import { startPracticeExam } from "@/lib/mcq/practice-service";
import {
  beginAttemptSession,
  createAttemptSession,
  getRemainingSeconds,
  saveAttemptDraft,
} from "@/lib/mcq/attempt-session";
import { COURSE_TO_MCQ_SUBJECT_MAP, getSchoolLevel, getSyllabusChapters } from "@/lib/content/syllabus";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { materializeLegacyMcqAssessment, practiceSelectionSourceId } from "@/lib/mcq/assessment-kernel-adapter";
import { isAssessmentKernelWriteEnabled } from "@/lib/mcq/kernel-rollout";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);

    const { searchParams } = request.nextUrl;
    const subject = searchParams.get("subject");
    const chaptersParam = searchParams.get("chapters");

    if (!subject) {
      return fail("Subject parameter is required.", 400);
    }

    const level = getSchoolLevel(studentClass);
    const syllabusChapters = getSyllabusChapters(level, subject);

    const selectedChapters = chaptersParam
      ? (chaptersParam.includes("|||")
        ? chaptersParam.split("|||").map((c) => decodeURIComponent(c.trim()))
        : (syllabusChapters.includes(decodeURIComponent(chaptersParam.trim()))
          ? [decodeURIComponent(chaptersParam.trim())]
          : chaptersParam.split(",").map((c) => decodeURIComponent(c.trim()))))
      : undefined;

    // Fetch admin-configurable settings
    const settings = await getPracticeSettings();

    const limitParam = searchParams.get("limit");
    let limit = settings.maxQuestionsPerTest;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if ([10, 15, 20, 25].includes(parsedLimit)) {
        limit = parsedLimit;
      }
    }

    const mode = searchParams.get("mode") === "teacher" ? "teacher" : "general";
    let teacherId: string | undefined = undefined;

    if (mode === "teacher") {
      // Find the teacher of this student for this subject
      const studentIdObj = new mongoose.Types.ObjectId(user.id);

      // Map Bengali subject to English equivalents for database query
      const isHsc = studentClass === "class-11" || studentClass === "class-12";
      const levelKey = isHsc ? "hsc" : "ssc";
      const mapping = COURSE_TO_MCQ_SUBJECT_MAP[levelKey] || {};
      const englishSubjects: string[] = [];
      for (const engSub in mapping) {
        if (mapping[engSub].includes(subject)) {
          englishSubjects.push(engSub);
        }
      }
      englishSubjects.push(subject);

      const teacher = await User.findOne({
        role: "teacher",
        $or: [
          { "teacherDomain.isAll": true },
          {
            "teacherDomain.students": studentIdObj,
            "teacherDomain.subjects": { $in: englishSubjects }
          }
        ]
      }).lean();
      if (!teacher) {
        return fail("You do not have a teacher assigned for this subject.", 400);
      }
      teacherId = String(teacher._id);
    }

    const examData = await startPracticeExam(
      subject,
      studentClass,
      selectedChapters,
      limit,
      settings.secondsPerQuestion,
      teacherId,
      user.id,
    );
    const selectedRows = await PracticeQuestion.find({ _id: { $in: examData.questions.map((question) => question.id) } }).lean();
    const selectedById = new Map(selectedRows.map((row) => [String(row._id), row]));
    const orderedRows = examData.questions.map((question) => selectedById.get(question.id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const owner = teacherId
      ? await User.findOne({ _id: teacherId, role: "teacher" }).select("_id role").lean()
      : await User.findOne({ role: "admin", isActive: true }).select("_id role").lean();
    const commonOrganizationId = orderedRows[0]?.organizationId ? String(orderedRows[0].organizationId) : undefined;
    const commonSubjectId = orderedRows[0]?.subjectId ? String(orderedRows[0].subjectId) : undefined;
    const kernel = isAssessmentKernelWriteEnabled() && owner && orderedRows.length === examData.questions.length
      ? await materializeLegacyMcqAssessment({
          source: { collection: "PracticeSelection", id: practiceSelectionSourceId({ questionIds: examData.questions.map((question) => question.id), durationSeconds: examData.durationSeconds, passMarkPercent: settings.passMarkPercent }) },
          organizationId: commonOrganizationId, subjectId: commonSubjectId, title: `${subject} MCQ Practice`, kind: "practice",
          durationSeconds: examData.durationSeconds, passRule: { mode: "percent", threshold: settings.passMarkPercent },
          ownerId: String(owner._id), ownerRole: owner.role as "admin" | "teacher",
          questions: orderedRows.map((question) => ({
            id: String(question._id), organizationId: question.organizationId ? String(question.organizationId) : undefined,
            subjectId: question.subjectId ? String(question.subjectId) : undefined, chapterId: question.chapterId ? String(question.chapterId) : undefined,
            topicId: question.topicId ? String(question.topicId) : undefined, prompt: question.question, options: question.options,
            correctIndex: question.correctIndex, explanation: question.explanation, marks: 1, ownerId: String(owner._id), ownerRole: owner.role as "admin" | "teacher", collection: "PracticeQuestion",
          })),
        })
      : null;
    if (kernel) {
      await PracticeQuestion.bulkWrite(orderedRows.map((question, index) => ({ updateOne: { filter: { _id: question._id }, update: { $set: { questionId: kernel.questionIds[index], questionVersionId: kernel.questionVersionIds[index] } } } })));
    }
    const attemptSession = await createAttemptSession({
      studentId: user.id,
      kind: "practice",
      subject,
      questionIds: examData.questions.map((question) => question.id),
      durationSeconds: examData.durationSeconds,
      organizationId: kernel ? String(kernel.organizationId) : undefined,
      assessmentId: kernel ? String(kernel.assessmentId) : undefined,
      assessmentVersionId: kernel ? String(kernel.assessmentVersionId) : undefined,
      questionVersionIds: kernel?.questionVersionIds.map(String),
    });

    return success({
      ...examData,
      attemptSessionId: attemptSession._id.toString(),
      passMarkPercent: settings.passMarkPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const beginSchema = z.object({
  attemptSessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const parsed = beginSchema.parse(await request.json());
    const session = await beginAttemptSession(
      parsed.attemptSessionId,
      user.id,
      "practice",
    );

    if (!session) {
      return fail("Practice attempt session is invalid or no longer available.", 400);
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
  responses: z.array(z.object({ questionId: z.string().min(1), selectedIndex: z.number().int().min(0).max(3).nullable() })).max(100),
});

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const parsed = autosaveSchema.parse(await request.json());
    const saved = await saveAttemptDraft({ sessionId: parsed.attemptSessionId, studentId: user.id, kind: "practice", expectedRevision: parsed.revision, responses: parsed.responses });
    if (!saved.ok) return fail(saved.reason === "conflict" ? "A newer answer draft already exists." : "Practice answer draft is invalid.", saved.reason === "conflict" ? 409 : 400);
    return success(saved);
  } catch (error) {
    return handleApiError(error);
  }
}
