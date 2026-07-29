import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentSubjectProgress } from "@/lib/db/models/StudentSubjectProgress";
import {
  HUB_THEMES,
  PROFILE_FRAMES,
  SUBJECT_XP_PER_LEVEL,
  visibleStreak,
} from "@/lib/gamification/engagement-rules";
import { getClassLeaderboard } from "@/lib/gamification/leaderboard-service";
import { getQuestState } from "@/lib/gamification/quest-service";
import { ACHIEVEMENTS, getDhakaDateKey } from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const [profile, achievements, subjects, quests, leaderboard] =
      await Promise.all([
        getOrCreateGameProfile(user.id),
        StudentAchievement.find({ student: user.id })
          .sort({ unlockedAt: -1 })
          .lean(),
        StudentSubjectProgress.find({ student: user.id })
          .sort({ xp: -1, lastPracticedAt: -1 })
          .lean(),
        getQuestState(user.id),
        getClassLeaderboard({
          studentId: user.id,
          studentClass,
        }),
      ]);
    const today = getDhakaDateKey();

    return success({
      profile: {
        totalXp: profile.totalXp,
        level: profile.level,
        currentStreak: visibleStreak({
          currentStreak: profile.currentStreak,
          lastQualifiedDate: profile.lastQualifiedDate,
          currentDateKey: today,
          streakFreezes: profile.streakFreezes,
        }),
        longestStreak: profile.longestStreak,
        dailyProgress:
          profile.dailyProgressDate === today ? profile.dailyProgress : 0,
        dailyGoalTarget: profile.dailyGoalTarget,
        testsCompleted: profile.testsCompleted,
        totalQuestionsAnswered: profile.totalQuestionsAnswered,
        totalCorrect: profile.totalCorrect,
        streakFreezes: profile.streakFreezes,
        streakFreezesUsed: profile.streakFreezesUsed,
        selectedFrame: profile.selectedFrame,
        selectedTheme: profile.selectedTheme,
      },
      achievements: achievements.flatMap((achievement) => {
        const definition =
          ACHIEVEMENTS[achievement.code as keyof typeof ACHIEVEMENTS];
        return definition
          ? [{ ...definition, unlockedAt: achievement.unlockedAt }]
          : [];
      }),
      subjects: subjects.map((subject) => ({
        subject: subject.subject,
        xp: subject.xp,
        level: subject.level,
        xpIntoLevel: subject.xp % SUBJECT_XP_PER_LEVEL,
        xpPerLevel: SUBJECT_XP_PER_LEVEL,
        attempts: subject.attempts,
        bestAccuracy: subject.bestAccuracy,
        lastAccuracy: subject.lastAccuracy,
        personalBestCount: subject.personalBestCount,
      })),
      quests,
      leaderboard,
      rewards: {
        frames: PROFILE_FRAMES.map((frame) => ({
          ...frame,
          unlocked: profile.level >= frame.requiredLevel,
          selected: profile.selectedFrame === frame.id,
        })),
        themes: HUB_THEMES.map((theme) => ({
          ...theme,
          unlocked: profile.level >= theme.requiredLevel,
          selected: profile.selectedTheme === theme.id,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
