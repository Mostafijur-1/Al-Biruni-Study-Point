import mongoose, { Types } from "mongoose";

import { GamificationEvent } from "@/lib/db/models/GamificationEvent";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import {
  ACHIEVEMENTS,
  DAILY_XP_CAP,
  DEFAULT_DAILY_GOAL,
  calculateLevel,
  calculatePracticeReward,
  differenceInDateKeys,
  getDhakaDateKey,
  getEarnedAchievementCodes,
} from "@/lib/gamification/rules";

type PracticeGamificationInput = {
  studentId: string;
  attemptId: string;
  score: number;
  totalQuestions: number;
  answeredCount: number;
  isCancelled: boolean;
  submittedAt: Date;
};

function profileSnapshot(profile: {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  dailyProgress: number;
  dailyGoalTarget: number;
}) {
  return {
    totalXp: profile.totalXp,
    level: profile.level,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    dailyProgress: profile.dailyProgress,
    dailyGoalTarget: profile.dailyGoalTarget,
  };
}

export async function getOrCreateGameProfile(studentId: string) {
  return StudentGameProfile.findOneAndUpdate(
    { student: studentId },
    {
      $setOnInsert: {
        totalXp: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        dailyProgress: 0,
        dailyGoalTarget: DEFAULT_DAILY_GOAL,
        testsCompleted: 0,
        totalQuestionsAnswered: 0,
        totalCorrect: 0,
      },
    },
    { new: true, upsert: true },
  );
}

export async function awardPracticeGamification(input: PracticeGamificationInput) {
  const reward = calculatePracticeReward(input);
  const dateKey = getDhakaDateKey(input.submittedAt);
  const existingEvent = await GamificationEvent.findOne({
    sourceAttempt: input.attemptId,
    kind: "practice_reward",
  }).lean();

  if (existingEvent) {
    const existingProfile = await getOrCreateGameProfile(input.studentId);
    return {
      xpEarned: existingEvent.xp,
      xpBreakdown: existingEvent.breakdown,
      profile: profileSnapshot(existingProfile),
      newAchievements: [],
    };
  }

  if (input.isCancelled) {
    const cancelledProfile = await getOrCreateGameProfile(input.studentId);
    return {
      xpEarned: 0,
      xpBreakdown: reward.breakdown,
      profile: profileSnapshot(cancelledProfile),
      newAchievements: [],
    };
  }

  const dbSession = await mongoose.startSession();
  let response:
    | {
        xpEarned: number;
        xpBreakdown: typeof reward.breakdown;
        profile: ReturnType<typeof profileSnapshot>;
        newAchievements: Array<{
          code: string;
          title: string;
          description: string;
        }>;
      }
    | undefined;

  try {
    await dbSession.withTransaction(async () => {
      const duplicate = await GamificationEvent.findOne({
        sourceAttempt: input.attemptId,
        kind: "practice_reward",
      }).session(dbSession);
      if (duplicate) {
        const profile = await StudentGameProfile.findOne({ student: input.studentId })
          .session(dbSession);
        if (!profile) throw new Error("Gamification profile is missing.");
        response = {
          xpEarned: duplicate.xp,
          xpBreakdown: duplicate.breakdown,
          profile: profileSnapshot(profile),
          newAchievements: [],
        };
        return;
      }

      const dailyTotals = await GamificationEvent.aggregate<{ total: number }>([
        { $match: { student: new Types.ObjectId(input.studentId), dateKey } },
        { $group: { _id: null, total: { $sum: "$xp" } } },
      ]).session(dbSession);
      const alreadyEarnedToday = dailyTotals[0]?.total ?? 0;
      const xpEarned = Math.max(
        0,
        Math.min(reward.rawXp, DAILY_XP_CAP - alreadyEarnedToday),
      );

      await GamificationEvent.create(
        [{
          student: input.studentId,
          sourceAttempt: input.attemptId,
          kind: "practice_reward",
          xp: xpEarned,
          dateKey,
          breakdown: reward.breakdown,
        }],
        { session: dbSession },
      );

      let profile = await StudentGameProfile.findOne({ student: input.studentId })
        .session(dbSession);
      if (!profile) {
        [profile] = await StudentGameProfile.create(
          [{
            student: input.studentId,
            dailyGoalTarget: DEFAULT_DAILY_GOAL,
          }],
          { session: dbSession },
        );
      }

      const dailyProgress = profile.dailyProgressDate === dateKey
        ? profile.dailyProgress + input.answeredCount
        : input.answeredCount;

      let currentStreak = profile.currentStreak;
      if (reward.qualifiedDay && profile.lastQualifiedDate !== dateKey) {
        currentStreak = profile.lastQualifiedDate &&
          differenceInDateKeys(profile.lastQualifiedDate, dateKey) === 1
          ? profile.currentStreak + 1
          : 1;
        profile.lastQualifiedDate = dateKey;
      }

      profile.totalXp += xpEarned;
      profile.level = calculateLevel(profile.totalXp);
      profile.currentStreak = currentStreak;
      profile.longestStreak = Math.max(profile.longestStreak, currentStreak);
      profile.dailyProgressDate = dateKey;
      profile.dailyProgress = dailyProgress;
      profile.testsCompleted += 1;
      profile.totalQuestionsAnswered += input.answeredCount;
      profile.totalCorrect += input.score;
      await profile.save({ session: dbSession });

      const earnedCodes = getEarnedAchievementCodes({
        testsCompleted: profile.testsCompleted,
        totalQuestionsAnswered: profile.totalQuestionsAnswered,
        currentStreak: profile.currentStreak,
        score: input.score,
        totalQuestions: input.totalQuestions,
        answeredCount: input.answeredCount,
      });
      const existingAchievements = await StudentAchievement.find({
        student: input.studentId,
        code: { $in: earnedCodes },
      })
        .select("code")
        .session(dbSession)
        .lean();
      const existingCodes = new Set(existingAchievements.map((achievement) => achievement.code));
      const newCodes = earnedCodes.filter((code) => !existingCodes.has(code));

      if (newCodes.length > 0) {
        await StudentAchievement.create(
          newCodes.map((code) => ({
            student: input.studentId,
            code,
            sourceAttempt: input.attemptId,
            unlockedAt: input.submittedAt,
          })),
          { session: dbSession },
        );
      }

      response = {
        xpEarned,
        xpBreakdown: reward.breakdown,
        profile: profileSnapshot(profile),
        newAchievements: newCodes.map((code) => ACHIEVEMENTS[code]),
      };
    });
  } finally {
    await dbSession.endSession();
  }

  if (!response) throw new Error("Could not apply practice gamification rewards.");
  return response;
}
