import mongoose from "mongoose";

import { MistakeReview } from "@/lib/db/models/MistakeReview";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import { StudentQuestClaim } from "@/lib/db/models/StudentQuestClaim";
import { VideoProgress } from "@/lib/db/models/VideoProgress";
import {
  QUESTS,
  getDhakaDayBounds,
  getDhakaWeekBounds,
  type QuestDefinition,
  type QuestMetric,
} from "@/lib/gamification/engagement-rules";
import {
  calculateLevel,
  getDhakaDateKey,
} from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";

type MetricValues = Record<QuestMetric, number>;

function practiceMetrics(
  attempts: Array<{
    subject: string;
    percentage: number;
    answers: Array<{ selectedIndex: number | null }>;
    createdAt: Date;
  }>,
) {
  const questions = attempts.reduce(
    (sum, attempt) =>
      sum + attempt.answers.filter((answer) => answer.selectedIndex !== null).length,
    0,
  );
  const activeDays = new Set(
    attempts.map((attempt) => getDhakaDateKey(attempt.createdAt)),
  ).size;
  const subjects = new Set(attempts.map((attempt) => attempt.subject)).size;
  const bySubject = new Map<string, number[]>();
  for (const attempt of attempts) {
    const values = bySubject.get(attempt.subject) ?? [];
    values.push(attempt.percentage);
    bySubject.set(attempt.subject, values);
  }
  let improvement = 0;
  for (const values of bySubject.values()) {
    for (let index = 1; index < values.length; index += 1) {
      improvement = Math.max(improvement, values[index] - values[index - 1]);
    }
  }
  return { questions, activeDays, subjects, improvement: Math.round(improvement) };
}

export async function getQuestState(studentId: string, now = new Date()) {
  const day = getDhakaDayBounds(now);
  const week = getDhakaWeekBounds(now);
  const attempts = await PracticeAttempt.find({
    student: studentId,
    isCancelled: { $ne: true },
    createdAt: { $gte: week.start, $lte: week.end },
  })
    .sort({ createdAt: 1 })
    .select("subject percentage answers createdAt")
    .lean();

  const dailyAttempts = attempts.filter(
    (attempt) => attempt.createdAt >= day.start && attempt.createdAt <= day.end,
  );
  const [
    dailyMistakeReviews,
    weeklyMistakeReviews,
    dailyLessons,
    weeklyLessons,
    claims,
  ] = await Promise.all([
    MistakeReview.countDocuments({
      student: studentId,
      lastReviewedAt: { $gte: day.start, $lte: day.end },
    }),
    MistakeReview.countDocuments({
      student: studentId,
      lastReviewedAt: { $gte: week.start, $lte: week.end },
    }),
    VideoProgress.countDocuments({
      student: studentId,
      status: "completed",
      completedAt: { $gte: day.start, $lte: day.end },
    }),
    VideoProgress.countDocuments({
      student: studentId,
      status: "completed",
      completedAt: { $gte: week.start, $lte: week.end },
    }),
    StudentQuestClaim.find({
      student: studentId,
      periodKey: { $in: [day.key, week.key] },
    })
      .select("questCode periodKey claimedAt")
      .lean(),
  ]);

  const dailyPractice = practiceMetrics(dailyAttempts);
  const weeklyPractice = practiceMetrics(attempts);
  const dailyMetrics: MetricValues = {
    questions: dailyPractice.questions,
    mistake_reviews: dailyMistakeReviews,
    lessons: dailyLessons,
    active_days: dailyPractice.activeDays,
    subjects: dailyPractice.subjects,
    improvement: dailyPractice.improvement,
  };
  const weeklyMetrics: MetricValues = {
    questions: weeklyPractice.questions,
    mistake_reviews: weeklyMistakeReviews,
    lessons: weeklyLessons,
    active_days: weeklyPractice.activeDays,
    subjects: weeklyPractice.subjects,
    improvement: weeklyPractice.improvement,
  };
  const claimKeys = new Set(
    claims.map((claim) => `${claim.questCode}:${claim.periodKey}`),
  );

  return QUESTS.map((quest) => {
    const periodKey = quest.period === "daily" ? day.key : week.key;
    const progress =
      quest.period === "daily"
        ? dailyMetrics[quest.metric]
        : weeklyMetrics[quest.metric];
    return {
      ...quest,
      periodKey,
      progress: Math.min(quest.target, progress),
      complete: progress >= quest.target,
      claimed: claimKeys.has(`${quest.code}:${periodKey}`),
    };
  });
}

export async function claimQuestReward(input: {
  studentId: string;
  questCode: string;
  now?: Date;
}) {
  const quests = await getQuestState(input.studentId, input.now);
  const quest = quests.find((item) => item.code === input.questCode);
  if (!quest) return { ok: false as const, reason: "not_found" as const };
  if (!quest.complete) return { ok: false as const, reason: "incomplete" as const };
  if (quest.claimed) {
    return { ok: true as const, alreadyClaimed: true, quest };
  }

  await getOrCreateGameProfile(input.studentId);
  const session = await mongoose.startSession();
  let profileSnapshot:
    | {
        totalXp: number;
        level: number;
        streakFreezes: number;
      }
    | undefined;

  try {
    await session.withTransaction(async () => {
      const duplicate = await StudentQuestClaim.findOne({
        student: input.studentId,
        questCode: quest.code,
        periodKey: quest.periodKey,
      }).session(session);
      if (duplicate) {
        const profile = await StudentGameProfile.findOne({
          student: input.studentId,
        }).session(session);
        if (!profile) throw new Error("Game profile is missing.");
        profileSnapshot = {
          totalXp: profile.totalXp,
          level: profile.level,
          streakFreezes: profile.streakFreezes,
        };
        return;
      }

      await StudentQuestClaim.create(
        [{
          student: input.studentId,
          questCode: quest.code,
          periodKey: quest.periodKey,
          xp: quest.xp,
          streakFreezes: quest.streakFreezes,
          claimedAt: input.now ?? new Date(),
        }],
        { session },
      );

      const profile = await StudentGameProfile.findOne({
        student: input.studentId,
      }).session(session);
      if (!profile) throw new Error("Game profile is missing.");
      profile.totalXp += quest.xp;
      profile.level = calculateLevel(profile.totalXp);
      profile.streakFreezes += quest.streakFreezes;
      await profile.save({ session });

      if (quest.period === "weekly") {
        await StudentAchievement.updateOne(
          { student: input.studentId, code: "QUEST_MASTER" },
          {
            $setOnInsert: {
              student: input.studentId,
              code: "QUEST_MASTER",
              unlockedAt: input.now ?? new Date(),
            },
          },
          { upsert: true, session },
        );
      }

      profileSnapshot = {
        totalXp: profile.totalXp,
        level: profile.level,
        streakFreezes: profile.streakFreezes,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!profileSnapshot) throw new Error("Could not claim quest reward.");
  return {
    ok: true as const,
    alreadyClaimed: false,
    quest,
    reward: {
      xp: quest.xp,
      streakFreezes: quest.streakFreezes,
    },
    profile: profileSnapshot,
  };
}

export function questDefinition(code: string): QuestDefinition | undefined {
  return QUESTS.find((quest) => quest.code === code);
}
