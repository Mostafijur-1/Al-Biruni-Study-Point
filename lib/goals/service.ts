import mongoose from "mongoose";

import {
  HSC_MCQ_SUBJECTS,
  SSC_MCQ_SUBJECTS,
} from "@/lib/content/syllabus";
import { DailyChallengeAttempt } from "@/lib/db/models/DailyChallengeAttempt";
import { FocusSession } from "@/lib/db/models/FocusSession";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import { StudentWeeklyGoal } from "@/lib/db/models/StudentWeeklyGoal";
import {
  WEEKLY_GOAL_DEFINITIONS,
  WEEKLY_GOAL_METRICS,
  getWeeklyGoalDefinition,
  getWeeklyGoalReward,
  goalProgressPercent,
  isStretchWeeklyGoal,
  isWeeklyGoalComplete,
  type WeeklyGoalMetric,
} from "@/lib/goals/rules";
import {
  getDhakaWeekBounds,
} from "@/lib/gamification/engagement-rules";
import {
  calculateLevel,
  differenceInDateKeys,
  getDhakaDateKey,
} from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import type { StudentClass } from "@/types";

type PracticeActivity = {
  subject: string;
  answers: Array<{ selectedIndex: number | null }>;
  createdAt: Date;
};

type FocusActivity = {
  subject: string;
  durationMinutes: number;
  completedAt?: Date;
};

type ChallengeActivity = {
  dateKey: string;
};

function allowedSubjects(studentClass: StudentClass) {
  return studentClass === "class-11" || studentClass === "class-12"
    ? HSC_MCQ_SUBJECTS
    : SSC_MCQ_SUBJECTS;
}

function weekDateKeys(startKey: string) {
  const start = new Date(`${startKey}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function answeredQuestions(attempt: PracticeActivity) {
  return attempt.answers.filter((answer) => answer.selectedIndex !== null).length;
}

function calculateProgress(input: {
  metric: WeeklyGoalMetric;
  subject?: string;
  practice: PracticeActivity[];
  focus: FocusActivity[];
  challenges: ChallengeActivity[];
}) {
  if (input.metric === "practice_questions") {
    return input.practice
      .filter((attempt) => !input.subject || attempt.subject === input.subject)
      .reduce((total, attempt) => total + answeredQuestions(attempt), 0);
  }
  if (input.metric === "focus_minutes") {
    return input.focus
      .filter((session) => !input.subject || session.subject === input.subject)
      .reduce((total, session) => total + session.durationMinutes, 0);
  }
  return new Set(input.challenges.map((attempt) => attempt.dateKey)).size;
}

async function weeklyActivity(studentId: string, now: Date) {
  const week = getDhakaWeekBounds(now);
  const endKey = weekDateKeys(week.key)[6];
  const [practice, focus, challenges] = await Promise.all([
    PracticeAttempt.find({
      student: studentId,
      isCancelled: { $ne: true },
      createdAt: { $gte: week.start, $lte: week.end },
    })
      .select("subject answers createdAt")
      .lean(),
    FocusSession.find({
      student: studentId,
      status: "completed",
      completedAt: { $gte: week.start, $lte: week.end },
    })
      .select("subject durationMinutes completedAt")
      .lean(),
    DailyChallengeAttempt.find({
      student: studentId,
      status: "submitted",
      dateKey: { $gte: week.key, $lte: endKey },
    })
      .select("dateKey")
      .lean(),
  ]);
  return {
    week,
    endKey,
    practice: practice as PracticeActivity[],
    focus: focus as FocusActivity[],
    challenges: challenges as ChallengeActivity[],
  };
}

export async function getWeeklyGoalBoard(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const activity = await weeklyActivity(input.studentId, now);
  const goal = await StudentWeeklyGoal.findOne({
    student: input.studentId,
    periodKey: activity.week.key,
  }).lean();
  const currentDateKey = getDhakaDateKey(now);
  const dateKeys = weekDateKeys(activity.week.key);
  const todayIndex = dateKeys.indexOf(currentDateKey);

  const days = dateKeys.map((dateKey, index) => {
    const practiceQuestions = activity.practice
      .filter((attempt) => getDhakaDateKey(attempt.createdAt) === dateKey)
      .reduce((total, attempt) => total + answeredQuestions(attempt), 0);
    const focusMinutes = activity.focus
      .filter(
        (session) =>
          session.completedAt &&
          getDhakaDateKey(session.completedAt) === dateKey,
      )
      .reduce((total, session) => total + session.durationMinutes, 0);
    const challengeCompleted = activity.challenges.some(
      (attempt) => attempt.dateKey === dateKey,
    );
    return {
      dateKey,
      dayIndex: index,
      isToday: dateKey === currentDateKey,
      isFuture: todayIndex >= 0 ? index > todayIndex : dateKey > currentDateKey,
      practiceQuestions,
      focusMinutes,
      challengeCompleted,
      active: practiceQuestions > 0 || focusMinutes > 0 || challengeCompleted,
    };
  });

  const progress = goal
    ? calculateProgress({
        metric: goal.metric,
        subject: goal.subject,
        practice: activity.practice,
        focus: activity.focus,
        challenges: activity.challenges,
      })
    : 0;
  const definition = goal ? getWeeklyGoalDefinition(goal.metric) : null;

  return {
    period: {
      key: activity.week.key,
      endKey: activity.endKey,
      daysRemaining: Math.max(
        0,
        differenceInDateKeys(currentDateKey, activity.endKey) + 1,
      ),
    },
    subjects: [...allowedSubjects(input.studentClass)],
    options: WEEKLY_GOAL_METRICS.map((metric) => ({
      ...WEEKLY_GOAL_DEFINITIONS[metric],
      targets: [...WEEKLY_GOAL_DEFINITIONS[metric].targets],
    })),
    current: goal && definition
      ? {
          id: String(goal._id),
          metric: goal.metric,
          label: definition.label,
          description: definition.description,
          unit: definition.unit,
          href: definition.href,
          subject: goal.subject ?? null,
          target: goal.target,
          rewardXp: goal.rewardXp,
          status: goal.status,
          progress: Math.min(goal.target, progress),
          rawProgress: progress,
          percent: goalProgressPercent(progress, goal.target),
          complete: isWeeklyGoalComplete(progress, goal.target),
          claimed: goal.status === "claimed",
          isStretch: isStretchWeeklyGoal(goal.metric, goal.target),
          createdAt: goal.createdAt,
          claimedAt: goal.claimedAt ?? null,
        }
      : null,
    activity: {
      days,
      totals: {
        practiceQuestions: activity.practice.reduce(
          (total, attempt) => total + answeredQuestions(attempt),
          0,
        ),
        focusMinutes: activity.focus.reduce(
          (total, session) => total + session.durationMinutes,
          0,
        ),
        challengeDays: new Set(
          activity.challenges.map((attempt) => attempt.dateKey),
        ).size,
        activeDays: days.filter((day) => day.active).length,
      },
    },
  };
}

export async function createWeeklyGoal(input: {
  studentId: string;
  studentClass: StudentClass;
  metric: WeeklyGoalMetric;
  target: number;
  subject?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const definition = getWeeklyGoalDefinition(input.metric);
  const rewardXp = getWeeklyGoalReward(input.metric, input.target);
  if (rewardXp === null) {
    return { ok: false as const, reason: "target" as const };
  }
  if (
    input.subject &&
    !(allowedSubjects(input.studentClass) as readonly string[]).includes(
      input.subject,
    )
  ) {
    return { ok: false as const, reason: "subject" as const };
  }
  const subject =
    definition.supportsSubject && input.subject ? input.subject : undefined;
  const periodKey = getDhakaWeekBounds(now).key;
  const existing = await StudentWeeklyGoal.findOne({
    student: input.studentId,
    periodKey,
  });
  if (existing) {
    return {
      ok: true as const,
      alreadyCreated: true,
      board: await getWeeklyGoalBoard(input),
    };
  }

  await StudentWeeklyGoal.create({
    student: input.studentId,
    periodKey,
    metric: input.metric,
    subject,
    target: input.target,
    rewardXp,
  });
  return {
    ok: true as const,
    alreadyCreated: false,
    board: await getWeeklyGoalBoard(input),
  };
}

export async function claimWeeklyGoal(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const board = await getWeeklyGoalBoard(input);
  const goal = board.current;
  if (!goal) return { ok: false as const, reason: "not_found" as const };
  if (!goal.complete) return { ok: false as const, reason: "incomplete" as const };
  if (goal.claimed) {
    return {
      ok: true as const,
      alreadyClaimed: true,
      reward: { xp: goal.rewardXp },
      board,
    };
  }

  await getOrCreateGameProfile(input.studentId);
  const session = await mongoose.startSession();
  let alreadyClaimed = false;
  let profileSnapshot:
    | { totalXp: number; level: number }
    | undefined;
  try {
    await session.withTransaction(async () => {
      const storedGoal = await StudentWeeklyGoal.findOne({
        _id: goal.id,
        student: input.studentId,
      }).session(session);
      if (!storedGoal) throw new Error("Weekly goal is missing.");

      const profile = await StudentGameProfile.findOne({
        student: input.studentId,
      }).session(session);
      if (!profile) throw new Error("Game profile is missing.");

      if (storedGoal.status === "claimed") {
        alreadyClaimed = true;
        profileSnapshot = {
          totalXp: profile.totalXp,
          level: profile.level,
        };
        return;
      }

      storedGoal.status = "claimed";
      storedGoal.claimedAt = now;
      await storedGoal.save({ session });

      profile.totalXp += storedGoal.rewardXp;
      profile.level = calculateLevel(profile.totalXp);
      await profile.save({ session });

      const achievementCodes = ["GOAL_GETTER"];
      if (isStretchWeeklyGoal(storedGoal.metric, storedGoal.target)) {
        achievementCodes.push("GOAL_CHAMPION");
      }
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

      profileSnapshot = {
        totalXp: profile.totalXp,
        level: profile.level,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!profileSnapshot) throw new Error("Could not claim weekly goal reward.");
  return {
    ok: true as const,
    alreadyClaimed,
    reward: { xp: goal.rewardXp },
    profile: profileSnapshot,
    board: await getWeeklyGoalBoard(input),
  };
}
