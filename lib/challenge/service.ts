import mongoose, { Types } from "mongoose";

import {
  DAILY_CHALLENGE_DURATION_SECONDS,
  DAILY_CHALLENGE_QUESTION_COUNT,
  calculateChallengeStreak,
  calculateDailyChallengeReward,
} from "@/lib/challenge/rules";
import { getSchoolLevel } from "@/lib/content/syllabus";
import { DailyChallenge } from "@/lib/db/models/DailyChallenge";
import {
  DailyChallengeAttempt,
  type IDailyChallengeAttempt,
} from "@/lib/db/models/DailyChallengeAttempt";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import { User } from "@/lib/db/models/User";
import {
  calculateLevel,
  getDhakaDateKey,
} from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import {
  dedupeSubmittedAnswers,
  scoreSubmittedAnswers,
  type SubmittedAnswer,
} from "@/lib/mcq/answer-scoring";
import type { StudentClass } from "@/types";

const SUBMISSION_GRACE_SECONDS = 30;

async function getOrCreateDailyChallenge(
  studentClass: StudentClass,
  now = new Date(),
) {
  const dateKey = getDhakaDateKey(now);
  const existing = await DailyChallenge.findOne({
    dateKey,
    studentClass,
  });
  if (existing) return existing;

  const level = getSchoolLevel(studentClass);
  const sampled = await PracticeQuestion.aggregate<{
    _id: Types.ObjectId;
    subject: string;
  }>([
    {
      $match: {
        level,
        isTeacherSet: { $ne: true },
      },
    },
    { $sample: { size: DAILY_CHALLENGE_QUESTION_COUNT } },
    { $project: { _id: 1, subject: 1 } },
  ]);
  if (sampled.length < DAILY_CHALLENGE_QUESTION_COUNT) return null;

  try {
    return await DailyChallenge.create({
      dateKey,
      studentClass,
      questionIds: sampled.map((question) => question._id),
      subjects: [...new Set(sampled.map((question) => question.subject))],
      durationSeconds: DAILY_CHALLENGE_DURATION_SECONDS,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return DailyChallenge.findOne({ dateKey, studentClass });
    }
    throw error;
  }
}

async function loadChallengeQuestions(questionIds: Types.ObjectId[]) {
  const questions = await PracticeQuestion.find({
    _id: { $in: questionIds },
  }).lean();
  const byId = new Map(
    questions.map((question) => [String(question._id), question]),
  );
  return questionIds.flatMap((questionId) => {
    const question = byId.get(String(questionId));
    return question ? [question] : [];
  });
}

export async function getDailyChallengeStatus(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const challenge = await getOrCreateDailyChallenge(input.studentClass, now);
  if (!challenge) {
    return {
      available: false as const,
      message: "আজকের চ্যালেঞ্জের জন্য পর্যাপ্ত প্রশ্ন পাওয়া যায়নি।",
    };
  }
  const [attempt, completedCount, classSize, history] = await Promise.all([
    DailyChallengeAttempt.findOne({
      challenge: challenge._id,
      student: input.studentId,
    }).lean(),
    DailyChallengeAttempt.countDocuments({
      challenge: challenge._id,
      status: "submitted",
    }),
    User.countDocuments({
      role: "student",
      studentClass: input.studentClass,
      isActive: true,
    }),
    DailyChallengeAttempt.find({
      student: input.studentId,
      status: "submitted",
    })
      .sort({ dateKey: -1 })
      .limit(30)
      .select("dateKey score totalQuestions percentage xpEarned submittedAt")
      .lean(),
  ]);
  const currentDateKey = getDhakaDateKey(now);
  const completedResult =
    attempt?.status === "submitted"
      ? await formatChallengeResult(attempt as IDailyChallengeAttempt)
      : null;

  return {
    available: true as const,
    dateKey: challenge.dateKey,
    subjects: challenge.subjects,
    questionCount: challenge.questionIds.length,
    durationSeconds: challenge.durationSeconds,
    status: attempt?.status ?? "ready",
    attempt: completedResult,
    challengeStreak: calculateChallengeStreak(
      history.map((item) => item.dateKey),
      currentDateKey,
    ),
    classPulse: {
      completedCount,
      classSize,
      percent:
        classSize > 0
          ? Math.min(100, Math.round((completedCount / classSize) * 100))
          : 0,
    },
    recentResults: history.slice(0, 7).map((item) => ({
      dateKey: item.dateKey,
      score: item.score,
      totalQuestions: item.totalQuestions,
      percentage: item.percentage,
      xpEarned: item.xpEarned,
    })),
  };
}

export async function startDailyChallenge(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const challenge = await getOrCreateDailyChallenge(input.studentClass, now);
  if (!challenge) {
    return { ok: false as const, reason: "unavailable" as const };
  }

  let attempt = await DailyChallengeAttempt.findOne({
    challenge: challenge._id,
    student: input.studentId,
  });
  if (attempt?.status === "submitted") {
    return { ok: false as const, reason: "completed" as const };
  }
  if (attempt?.status === "expired") {
    return { ok: false as const, reason: "expired" as const };
  }
  if (!attempt) {
    try {
      attempt = await DailyChallengeAttempt.create({
        challenge: challenge._id,
        student: input.studentId,
        dateKey: challenge.dateKey,
        status: "started",
        startedAt: now,
        expiresAt: new Date(
          now.getTime() + challenge.durationSeconds * 1_000,
        ),
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        attempt = await DailyChallengeAttempt.findOne({
          challenge: challenge._id,
          student: input.studentId,
        });
      } else {
        throw error;
      }
    }
  }
  if (!attempt) throw new Error("Could not start daily challenge.");

  if (
    now.getTime() >
    attempt.expiresAt.getTime() + SUBMISSION_GRACE_SECONDS * 1_000
  ) {
    attempt.status = "expired";
    await attempt.save();
    return { ok: false as const, reason: "expired" as const };
  }

  const questions = await loadChallengeQuestions(challenge.questionIds);
  if (questions.length !== challenge.questionIds.length) {
    return { ok: false as const, reason: "unavailable" as const };
  }
  return {
    ok: true as const,
    attemptId: attempt._id.toString(),
    dateKey: challenge.dateKey,
    subjects: challenge.subjects,
    durationSeconds: challenge.durationSeconds,
    remainingSeconds: Math.max(
      0,
      Math.ceil((attempt.expiresAt.getTime() - now.getTime()) / 1_000),
    ),
    questions: questions.map((question) => ({
      id: String(question._id),
      question: question.question,
      options: question.options,
      imageUrl: question.imageUrl,
      subject: question.subject,
    })),
  };
}

export async function submitDailyChallenge(input: {
  studentId: string;
  attemptId: string;
  answers: SubmittedAnswer[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const existingAttempt = await DailyChallengeAttempt.findOne({
    _id: input.attemptId,
    student: input.studentId,
  });
  if (!existingAttempt) {
    return { ok: false as const, reason: "not_found" as const };
  }
  if (existingAttempt.status === "submitted") {
    return {
      ok: true as const,
      alreadySubmitted: true,
      result: await formatChallengeResult(existingAttempt),
    };
  }
  if (
    existingAttempt.status === "expired" ||
    now.getTime() >
      existingAttempt.expiresAt.getTime() + SUBMISSION_GRACE_SECONDS * 1_000
  ) {
    existingAttempt.status = "expired";
    await existingAttempt.save();
    return { ok: false as const, reason: "expired" as const };
  }

  const challenge = await DailyChallenge.findById(existingAttempt.challenge);
  if (!challenge) return { ok: false as const, reason: "not_found" as const };
  const answers = dedupeSubmittedAnswers(input.answers);
  const allowedIds = new Set(challenge.questionIds.map(String));
  if (
    answers.length !== allowedIds.size ||
    answers.some((answer) => !allowedIds.has(answer.questionId))
  ) {
    return { ok: false as const, reason: "questions" as const };
  }

  const questions = await loadChallengeQuestions(challenge.questionIds);
  if (questions.length !== challenge.questionIds.length) {
    return { ok: false as const, reason: "questions" as const };
  }
  const scoring = scoreSubmittedAnswers(
    answers,
    questions.map((question) => ({
      id: String(question._id),
      correctIndex: question.correctIndex,
    })),
  );
  if (scoring.invalidQuestionIds.length > 0) {
    return { ok: false as const, reason: "questions" as const };
  }
  const timeTakenSeconds = Math.max(
    0,
    Math.min(
      challenge.durationSeconds,
      Math.round((now.getTime() - existingAttempt.startedAt.getTime()) / 1_000),
    ),
  );
  const reward = calculateDailyChallengeReward({
    score: scoring.score,
    totalQuestions: questions.length,
    timeTakenSeconds,
  });
  const percentage = Number(
    ((scoring.score / questions.length) * 100).toFixed(2),
  );
  const recentDates = await DailyChallengeAttempt.find({
    student: input.studentId,
    status: "submitted",
  })
    .sort({ dateKey: -1 })
    .limit(30)
    .select("dateKey")
    .lean();
  const challengeStreak = calculateChallengeStreak(
    [challenge.dateKey, ...recentDates.map((attempt) => attempt.dateKey)],
    challenge.dateKey,
  );

  await getOrCreateGameProfile(input.studentId);
  const session = await mongoose.startSession();
  let savedAttempt: IDailyChallengeAttempt | null = null;
  let profileSnapshot: { totalXp: number; level: number } | undefined;
  try {
    await session.withTransaction(async () => {
      const attempt = await DailyChallengeAttempt.findOne({
        _id: input.attemptId,
        student: input.studentId,
      }).session(session);
      if (!attempt) throw new Error("Challenge attempt is missing.");
      if (attempt.status === "submitted") {
        savedAttempt = attempt;
        const profile = await StudentGameProfile.findOne({
          student: input.studentId,
        }).session(session);
        if (!profile) throw new Error("Game profile is missing.");
        profileSnapshot = { totalXp: profile.totalXp, level: profile.level };
        return;
      }

      attempt.status = "submitted";
      attempt.answers = scoring.records.map((answer) => ({
        questionId: new Types.ObjectId(answer.questionId),
        selectedIndex: answer.selectedIndex,
        isCorrect: answer.isCorrect,
      }));
      attempt.score = scoring.score;
      attempt.totalQuestions = questions.length;
      attempt.percentage = percentage;
      attempt.timeTakenSeconds = timeTakenSeconds;
      attempt.xpEarned = reward.xp;
      attempt.submittedAt = now;
      await attempt.save({ session });

      const profile = await StudentGameProfile.findOne({
        student: input.studentId,
      }).session(session);
      if (!profile) throw new Error("Game profile is missing.");
      profile.totalXp += reward.xp;
      profile.level = calculateLevel(profile.totalXp);
      profile.dailyProgress =
        profile.dailyProgressDate === challenge.dateKey
          ? profile.dailyProgress + questions.length
          : questions.length;
      profile.dailyProgressDate = challenge.dateKey;
      profile.testsCompleted += 1;
      profile.totalQuestionsAnswered += questions.length;
      profile.totalCorrect += scoring.score;
      await profile.save({ session });

      const achievementCodes = ["DAILY_CHALLENGER"];
      if (scoring.score === questions.length) {
        achievementCodes.push("CHALLENGE_ACE");
      }
      if (challengeStreak >= 7) achievementCodes.push("CHALLENGE_WEEK");
      for (const code of achievementCodes) {
        await StudentAchievement.updateOne(
          { student: input.studentId, code },
          {
            $setOnInsert: {
              student: input.studentId,
              code,
              unlockedAt: now,
            },
          },
          { upsert: true, session },
        );
      }

      savedAttempt = attempt;
      profileSnapshot = { totalXp: profile.totalXp, level: profile.level };
    });
  } finally {
    await session.endSession();
  }

  if (!savedAttempt || !profileSnapshot) {
    throw new Error("Could not submit daily challenge.");
  }
  return {
    ok: true as const,
    alreadySubmitted: false,
    result: await formatChallengeResult(savedAttempt),
    reward: {
      xp: reward.xp,
      breakdown: reward.breakdown,
      profile: profileSnapshot,
    },
    challengeStreak,
  };
}

async function formatChallengeResult(attempt: IDailyChallengeAttempt) {
  const challenge = await DailyChallenge.findById(attempt.challenge).lean();
  if (!challenge) throw new Error("Challenge is missing.");
  const questions = await loadChallengeQuestions(challenge.questionIds);
  const selected = new Map(
    attempt.answers.map((answer) => [
      String(answer.questionId),
      answer.selectedIndex,
    ]),
  );
  return {
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    xpEarned: attempt.xpEarned,
    timeTakenSeconds: attempt.timeTakenSeconds,
    solutions: questions.map((question) => ({
      questionId: String(question._id),
      question: question.question,
      options: question.options,
      imageUrl: question.imageUrl,
      subject: question.subject,
      selectedIndex: selected.get(String(question._id)) ?? null,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    })),
  };
}
