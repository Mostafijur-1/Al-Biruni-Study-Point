import { NextRequest } from "next/server";
import { z } from "zod";

import mongoose from "mongoose";

import { getSchoolLevel, COURSE_TO_MCQ_SUBJECT_MAP } from "@/lib/content/syllabus";
import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { loadFullQuestionById, scorePracticeAttempt } from "@/lib/mcq/practice-service";
import { connectDB } from "@/lib/db/connect";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { User } from "@/lib/db/models/User";
import { getPracticeSettings } from "@/lib/db/models/PracticeSettings";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  loadSubmissionSession,
  markAttemptSessionSubmitted,
} from "@/lib/mcq/attempt-session";
import { awardPracticeGamification } from "@/lib/gamification/service";
import { dedupeSubmittedAnswers } from "@/lib/mcq/answer-scoring";
import { syncMistakesFromAnswers } from "@/lib/learning/mistake-service";
import { awardSubjectProgress } from "@/lib/gamification/subject-progress-service";
import { validateLegacyIndexResponses } from "@/lib/assessment-kernel";

const submitPracticeSchema = z.object({
  attemptSessionId: z.string().min(1),
  subject: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().int().min(0).max(3).nullable(),
    }),
  ),
  timeTaken: z.number().min(0).optional(),
  mode: z.enum(["general", "teacher"]).optional(),
  isCancelled: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const rateLimit = await consumeRateLimit("student:practice-submit", user.id, {
      limit: 20,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    const studentClass = requireStudentClass(user);

    const parsed = submitPracticeSchema.parse(await request.json());
    const submittedAnswers = dedupeSubmittedAnswers(parsed.answers);
    async function findCompletedSubmission() {
      const [existingAttempt, existingResult] = await Promise.all([
        PracticeAttempt.findOne({
          attemptSession: parsed.attemptSessionId,
          student: user.id,
          subject: parsed.subject,
        }).lean(),
        PracticeResult.findOne({
          attemptSession: parsed.attemptSessionId,
          student: user.id,
          subject: parsed.subject,
        }).lean(),
      ]);

      if (!existingAttempt || !existingResult) return null;

      let gamification;
      try {
        gamification = await awardPracticeGamification({
          studentId: user.id,
          attemptId: existingAttempt._id.toString(),
          score: existingResult.score,
          totalQuestions: existingResult.totalQuestions,
          answeredCount: existingAttempt.answers.filter(
            (answer) => answer.selectedIndex !== null,
          ).length,
          isCancelled: existingResult.isCancelled || false,
          submittedAt: existingResult.submittedAt,
        });
      } catch (gamificationError) {
        console.error("Could not apply practice gamification rewards", gamificationError);
      }

      return success({
        result: existingResult,
        totalQuestions: existingResult.totalQuestions,
        solutions: existingAttempt.answers.map((answer) => ({
          questionId: String(answer.questionId),
          correctIndex: answer.correctIndex,
          explanation: answer.explanation,
        })),
        gamification,
        alreadySubmitted: true,
      });
    }

    const completedSubmission = await findCompletedSubmission();
    if (completedSubmission) return completedSubmission;

    const submissionSession = await loadSubmissionSession({
      sessionId: parsed.attemptSessionId,
      studentId: user.id,
      kind: "practice",
      subject: parsed.subject,
      submittedQuestionIds: submittedAnswers.map((answer) => answer.questionId),
    });
    if (!submissionSession.ok) {
      const racedSubmission = await findCompletedSubmission();
      if (racedSubmission) return racedSubmission;

      const message = submissionSession.reason === "expired"
        ? "This practice session has expired. Please start a new test."
        : "Practice attempt session validation failed.";
      return fail(message, 400);
    }
    const responseValidation = validateLegacyIndexResponses(
      parsed.answers,
      submissionSession.session.questionIds.map(String),
    );
    if (!responseValidation.ok) {
      return fail(responseValidation.code === "DUPLICATE_RESPONSE"
        ? "The submission contains duplicate question responses."
        : "The submission contains an invalid question response.", 400);
    }

    // Fetch admin-configurable pass mark
    const settings = await getPracticeSettings();

    const scoring = await scorePracticeAttempt(
      parsed.subject,
      studentClass,
      submittedAnswers,
      settings.passMarkPercent
    );
    if (scoring.invalidQuestionIds.length > 0) {
      return fail("The submission contains invalid questions for this subject or class.", 400);
    }

    const isTeacher = parsed.mode === "teacher";
    
    // Resolve the student's teacher for this subject if in teacher mode
    let teacherId: string | undefined = undefined;
    if (isTeacher) {
      const studentIdObj = new mongoose.Types.ObjectId(user.id);

      // Map Bengali subject to English equivalents for database query
      const isHsc = studentClass === "class-11" || studentClass === "class-12";
      const levelKey = isHsc ? "hsc" : "ssc";
      const mapping = COURSE_TO_MCQ_SUBJECT_MAP[levelKey] || {};
      const englishSubjects: string[] = [];
      for (const engSub in mapping) {
        if (mapping[engSub].includes(parsed.subject)) {
          englishSubjects.push(engSub);
        }
      }
      englishSubjects.push(parsed.subject);

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
      if (teacher) {
        teacherId = String(teacher._id);
      }
    }

    // Build detailed answer records (including question text and options)
    const level = getSchoolLevel(studentClass);
    const detailedAnswers = await Promise.all(
      scoring.solutions.map(async (sol) => {
        const studentAns = submittedAnswers.find((a) => a.questionId === sol.questionId);
        const full = await loadFullQuestionById(level, parsed.subject, sol.questionId);
        const selectedIndex = studentAns?.selectedIndex ?? null;
        return {
          questionId: sol.questionId,
          question: full?.question ?? "",
          options: full?.options ?? [],
          selectedIndex,
          isCorrect: selectedIndex !== null && selectedIndex === sol.correctIndex,
          correctIndex: sol.correctIndex,
          explanation: sol.explanation,
          imageUrl: full?.imageUrl,
        };
      })
    );

    // Save detailed attempt (teacher view)
    const attempt = await PracticeAttempt.findOneAndUpdate(
      { attemptSession: submissionSession.session._id },
      {
        $setOnInsert: {
          student: user.id,
          subject: parsed.subject,
          answers: detailedAnswers,
          assessmentSnapshot: {
            subject: parsed.subject,
            totalQuestions: scoring.totalQuestions,
            passMarkPercent: settings.passMarkPercent,
            mode: isTeacher ? "teacher" : "general",
          },
          totalQuestions: scoring.totalQuestions,
          score: scoring.score,
          percentage: scoring.percentage,
          isPassed: scoring.isPassed,
          timeTaken: submissionSession.timeTaken,
          isTeacherSet: isTeacher,
          teacherId: teacherId || undefined,
          isCancelled: parsed.isCancelled || false,
          passMarkPercent: settings.passMarkPercent,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // Save only the summary result (existing behavior)
    const result = await PracticeResult.findOneAndUpdate(
      { attemptSession: submissionSession.session._id },
      {
        $setOnInsert: {
          student: user.id,
          subject: parsed.subject,
          score: scoring.score,
          totalQuestions: scoring.totalQuestions,
          percentage: scoring.percentage,
          isPassed: scoring.isPassed,
          timeTaken: submissionSession.timeTaken,
          submittedAt: submissionSession.submittedAt,
          isTeacherSet: isTeacher,
          teacherId: teacherId || undefined,
          isCancelled: parsed.isCancelled || false,
          passMarkPercent: settings.passMarkPercent,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await markAttemptSessionSubmitted(
      submissionSession.session._id.toString(),
      submissionSession.submittedAt,
    );

    if (!parsed.isCancelled) {
      try {
        await syncMistakesFromAnswers({
          studentId: user.id,
          subject: parsed.subject,
          answers: detailedAnswers,
          attemptedAt: submissionSession.submittedAt,
        });
      } catch (mistakeSyncError) {
        // Review features must never invalidate a saved academic result.
        console.error("Could not update the student's mistake notebook", mistakeSyncError);
      }
    }

    let gamification;
    try {
      gamification = await awardPracticeGamification({
        studentId: user.id,
        attemptId: attempt._id.toString(),
        score: scoring.score,
        totalQuestions: scoring.totalQuestions,
        answeredCount: submittedAnswers.filter((answer) => answer.selectedIndex !== null).length,
        isCancelled: parsed.isCancelled || false,
        submittedAt: submissionSession.submittedAt,
      });
    } catch (gamificationError) {
      // A reward outage must never invalidate an already-saved academic result.
      console.error("Could not apply practice gamification rewards", gamificationError);
    }

    let subjectProgress;
    if (!parsed.isCancelled) {
      try {
        subjectProgress = await awardSubjectProgress({
          studentId: user.id,
          attemptId: attempt._id.toString(),
          subject: parsed.subject,
          score: scoring.score,
          totalQuestions: scoring.totalQuestions,
          percentage: scoring.percentage,
          submittedAt: submissionSession.submittedAt,
        });
      } catch (subjectProgressError) {
        // Progress feedback must never invalidate an already-saved academic result.
        console.error("Could not update subject progression", subjectProgressError);
      }
    }

    return success({
      result,
      totalQuestions: scoring.totalQuestions,
      solutions: scoring.solutions,
      gamification,
      subjectProgress,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
