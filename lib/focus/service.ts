import mongoose from "mongoose";

import {
  HSC_MCQ_SUBJECTS,
  SSC_MCQ_SUBJECTS,
} from "@/lib/content/syllabus";
import { FocusSession, type IFocusSession } from "@/lib/db/models/FocusSession";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import {
  FOCUS_COMPLETION_WINDOW_MINUTES,
  FOCUS_INTENTIONS,
  FOCUS_REFLECTIONS,
  WEEKLY_FOCUS_GOAL_MINUTES,
  calculateFocusReward,
  calculateFocusStreak,
  isFocusCompletionEligible,
  type FocusDuration,
  type FocusIntention,
  type FocusReflection,
} from "@/lib/focus/rules";
import {
  getDhakaDayBounds,
  getDhakaWeekBounds,
  resolveStreakUpdate,
} from "@/lib/gamification/engagement-rules";
import { calculateLevel, getDhakaDateKey } from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import type { StudentClass } from "@/types";

function allowedSubjects(studentClass: StudentClass) {
  return studentClass === "class-11" || studentClass === "class-12"
    ? HSC_MCQ_SUBJECTS
    : SSC_MCQ_SUBJECTS;
}

function sessionSnapshot(session: {
  _id: unknown;
  subject: string;
  intention: FocusIntention;
  durationMinutes: number;
  status: string;
  startedAt: Date;
  endsAt: Date;
  reflection?: FocusReflection;
  xpEarned: number;
  dateKey: string;
}) {
  return {
    id: String(session._id),
    subject: session.subject,
    intention: session.intention,
    intentionLabel: FOCUS_INTENTIONS[session.intention].label,
    durationMinutes: session.durationMinutes,
    status: session.status,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    reflection: session.reflection,
    reflectionLabel: session.reflection
      ? FOCUS_REFLECTIONS[session.reflection].label
      : null,
    xpEarned: session.xpEarned,
    dateKey: session.dateKey,
  };
}

export async function getFocusStatus(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiryBoundary = new Date(
    now.getTime() - FOCUS_COMPLETION_WINDOW_MINUTES * 60_000,
  );
  await FocusSession.updateMany(
    {
      student: input.studentId,
      status: "active",
      endsAt: { $lt: expiryBoundary },
    },
    { $set: { status: "expired" } },
  );

  const day = getDhakaDayBounds(now);
  const week = getDhakaWeekBounds(now);
  const [current, completedThisWeek, activeClassmates] = await Promise.all([
    FocusSession.findOne({
      student: input.studentId,
      status: "active",
    })
      .sort({ startedAt: -1 })
      .lean(),
    FocusSession.find({
      student: input.studentId,
      status: "completed",
      completedAt: { $gte: week.start, $lte: week.end },
    })
      .sort({ completedAt: -1 })
      .lean(),
    FocusSession.countDocuments({
      studentClass: input.studentClass,
      status: "active",
      endsAt: { $gt: now },
    }),
  ]);
  const todaySessions = completedThisWeek.filter(
    (session) =>
      session.completedAt &&
      session.completedAt >= day.start &&
      session.completedAt <= day.end,
  );
  const todayMinutes = todaySessions.reduce(
    (sum, session) => sum + session.durationMinutes,
    0,
  );
  const weekMinutes = completedThisWeek.reduce(
    (sum, session) => sum + session.durationMinutes,
    0,
  );
  const currentDateKey = getDhakaDateKey(now);

  return {
    subjects: [...allowedSubjects(input.studentClass)],
    intentions: Object.values(FOCUS_INTENTIONS),
    reflections: Object.values(FOCUS_REFLECTIONS),
    durations: [15, 25, 45],
    current: current ? sessionSnapshot(current) : null,
    canCompleteCurrent: current
      ? isFocusCompletionEligible({
          startedAt: current.startedAt,
          durationMinutes: current.durationMinutes,
          now,
        })
      : false,
    totals: {
      todayMinutes,
      weekMinutes,
      weeklyGoalMinutes: WEEKLY_FOCUS_GOAL_MINUTES,
      weeklyPercent: Math.min(
        100,
        Math.round((weekMinutes / WEEKLY_FOCUS_GOAL_MINUTES) * 100),
      ),
      completedSessions: completedThisWeek.length,
      focusStreak: calculateFocusStreak(
        completedThisWeek.map((session) => session.dateKey),
        currentDateKey,
      ),
    },
    activeClassmates,
    recentSessions: completedThisWeek
      .slice(0, 7)
      .map((session) => sessionSnapshot(session)),
  };
}

export async function startFocusSession(input: {
  studentId: string;
  studentClass: StudentClass;
  subject: string;
  intention: FocusIntention;
  durationMinutes: FocusDuration;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (
    !(allowedSubjects(input.studentClass) as readonly string[]).includes(
      input.subject,
    )
  ) {
    return { ok: false as const, reason: "subject" as const };
  }

  const staleBoundary = new Date(
    now.getTime() - FOCUS_COMPLETION_WINDOW_MINUTES * 60_000,
  );
  await FocusSession.updateMany(
    {
      student: input.studentId,
      status: "active",
      endsAt: { $lt: staleBoundary },
    },
    { $set: { status: "expired" } },
  );
  const existing = await FocusSession.findOne({
    student: input.studentId,
    status: "active",
  });
  if (existing) {
    return {
      ok: true as const,
      alreadyActive: true,
      session: sessionSnapshot(existing),
    };
  }

  const session = await FocusSession.create({
    student: input.studentId,
    studentClass: input.studentClass,
    subject: input.subject,
    intention: input.intention,
    durationMinutes: input.durationMinutes,
    status: "active",
    dateKey: getDhakaDateKey(now),
    startedAt: now,
    endsAt: new Date(now.getTime() + input.durationMinutes * 60_000),
  });
  return {
    ok: true as const,
    alreadyActive: false,
    session: sessionSnapshot(session),
  };
}

export async function completeFocusSession(input: {
  studentId: string;
  sessionId: string;
  reflection: FocusReflection;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const existing = await FocusSession.findOne({
    _id: input.sessionId,
    student: input.studentId,
  });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  if (existing.status === "completed") {
    return {
      ok: true as const,
      alreadyCompleted: true,
      session: sessionSnapshot(existing),
    };
  }
  if (existing.status !== "active") {
    return { ok: false as const, reason: "inactive" as const };
  }
  if (
    !isFocusCompletionEligible({
      startedAt: existing.startedAt,
      durationMinutes: existing.durationMinutes,
      now,
    })
  ) {
    return { ok: false as const, reason: "early" as const };
  }
  if (
    now.getTime() >
    existing.endsAt.getTime() + FOCUS_COMPLETION_WINDOW_MINUTES * 60_000
  ) {
    existing.status = "expired";
    await existing.save();
    return { ok: false as const, reason: "expired" as const };
  }

  const day = getDhakaDayBounds(now);
  const week = getDhakaWeekBounds(now);
  const [todaySessions, weekSessions] = await Promise.all([
    FocusSession.find({
      student: input.studentId,
      status: "completed",
      completedAt: { $gte: day.start, $lte: day.end },
    })
      .select("xpEarned")
      .lean(),
    FocusSession.find({
      student: input.studentId,
      status: "completed",
      completedAt: { $gte: week.start, $lte: week.end },
    })
      .select("durationMinutes dateKey")
      .lean(),
  ]);
  const earnedToday = todaySessions.reduce(
    (sum, session) => sum + session.xpEarned,
    0,
  );
  const xpEarned = calculateFocusReward({
    durationMinutes: existing.durationMinutes,
    xpEarnedToday: earnedToday,
  });
  const weeklyMinutes =
    weekSessions.reduce(
      (sum, session) => sum + session.durationMinutes,
      0,
    ) + existing.durationMinutes;
  const focusStreak = calculateFocusStreak(
    [existing.dateKey, ...weekSessions.map((session) => session.dateKey)],
    getDhakaDateKey(now),
  );

  await getOrCreateGameProfile(input.studentId);
  const dbSession = await mongoose.startSession();
  let completed: IFocusSession | null = null;
  let profileSnapshot:
    | {
        totalXp: number;
        level: number;
        currentStreak: number;
      }
    | undefined;
  try {
    await dbSession.withTransaction(async () => {
      const session = await FocusSession.findOne({
        _id: input.sessionId,
        student: input.studentId,
      }).session(dbSession);
      if (!session) throw new Error("Focus session is missing.");
      if (session.status === "completed") {
        completed = session;
        const profile = await StudentGameProfile.findOne({
          student: input.studentId,
        }).session(dbSession);
        if (!profile) throw new Error("Game profile is missing.");
        profileSnapshot = {
          totalXp: profile.totalXp,
          level: profile.level,
          currentStreak: profile.currentStreak,
        };
        return;
      }
      if (session.status !== "active") {
        throw new Error("Focus session is no longer active.");
      }

      session.status = "completed";
      session.completedAt = now;
      session.reflection = input.reflection;
      session.xpEarned = xpEarned;
      await session.save({ session: dbSession });

      const profile = await StudentGameProfile.findOne({
        student: input.studentId,
      }).session(dbSession);
      if (!profile) throw new Error("Game profile is missing.");
      const dateKey = getDhakaDateKey(now);
      if (profile.lastQualifiedDate !== dateKey) {
        const streak = resolveStreakUpdate({
          currentStreak: profile.currentStreak,
          lastQualifiedDate: profile.lastQualifiedDate,
          currentDateKey: dateKey,
          streakFreezes: profile.streakFreezes,
        });
        profile.currentStreak = streak.currentStreak;
        profile.streakFreezes = streak.streakFreezes;
        if (streak.streakFreezeUsed) profile.streakFreezesUsed += 1;
        profile.lastQualifiedDate = dateKey;
        profile.longestStreak = Math.max(
          profile.longestStreak,
          profile.currentStreak,
        );
      }
      profile.totalXp += xpEarned;
      profile.level = calculateLevel(profile.totalXp);
      await profile.save({ session: dbSession });

      const achievementCodes = ["FOCUS_STARTER"];
      if (session.durationMinutes === 45) {
        achievementCodes.push("DEEP_FOCUS");
      }
      if (weeklyMinutes >= WEEKLY_FOCUS_GOAL_MINUTES) {
        achievementCodes.push("FOCUS_CENTURY");
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
          { upsert: true, session: dbSession },
        );
      }

      completed = session;
      profileSnapshot = {
        totalXp: profile.totalXp,
        level: profile.level,
        currentStreak: profile.currentStreak,
      };
    });
  } finally {
    await dbSession.endSession();
  }

  if (!completed || !profileSnapshot) {
    throw new Error("Could not complete focus session.");
  }
  return {
    ok: true as const,
    alreadyCompleted: false,
    session: sessionSnapshot(completed),
    reward: {
      xp: xpEarned,
      profile: profileSnapshot,
    },
    totals: {
      weeklyMinutes,
      weeklyGoalMinutes: WEEKLY_FOCUS_GOAL_MINUTES,
      focusStreak,
    },
  };
}

export async function cancelFocusSession(input: {
  studentId: string;
  sessionId: string;
  now?: Date;
}) {
  const session = await FocusSession.findOne({
    _id: input.sessionId,
    student: input.studentId,
  });
  if (!session) return { ok: false as const, reason: "not_found" as const };
  if (session.status !== "active") {
    return { ok: false as const, reason: "inactive" as const };
  }
  session.status = "cancelled";
  session.cancelledAt = input.now ?? new Date();
  await session.save();
  return { ok: true as const };
}
