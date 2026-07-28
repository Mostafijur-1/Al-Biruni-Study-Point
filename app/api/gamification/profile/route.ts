import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import {
  ACHIEVEMENTS,
  differenceInDateKeys,
  getDhakaDateKey,
} from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const profile = await getOrCreateGameProfile(user.id);
    const achievements = await StudentAchievement.find({ student: user.id })
      .sort({ unlockedAt: -1 })
      .limit(5)
      .lean();
    const today = getDhakaDateKey();
    const currentStreak = profile.lastQualifiedDate &&
      differenceInDateKeys(profile.lastQualifiedDate, today) > 1
      ? 0
      : profile.currentStreak;

    return success({
      profile: {
        totalXp: profile.totalXp,
        level: profile.level,
        currentStreak,
        longestStreak: profile.longestStreak,
        dailyProgress: profile.dailyProgressDate === today ? profile.dailyProgress : 0,
        dailyGoalTarget: profile.dailyGoalTarget,
        testsCompleted: profile.testsCompleted,
        totalQuestionsAnswered: profile.totalQuestionsAnswered,
        totalCorrect: profile.totalCorrect,
      },
      achievements: achievements.flatMap((achievement) => {
        const definition = ACHIEVEMENTS[
          achievement.code as keyof typeof ACHIEVEMENTS
        ];
        return definition
          ? [{ ...definition, unlockedAt: achievement.unlockedAt }]
          : [];
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
