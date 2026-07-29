import mongoose from "mongoose";

import { FormulaSprintAttempt } from "@/lib/db/models/FormulaSprintAttempt";
import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import {
  formulaCardById,
  formulaCardsForLevel,
  type FormulaLevel,
} from "@/lib/formulas/cards";
import {
  calculateFormulaSprintReward,
  calculateFormulaStreak,
  formulaConfidencePercent,
  selectFormulaCardIds,
  type FormulaConfidence,
} from "@/lib/formulas/rules";
import { resolveStreakUpdate } from "@/lib/gamification/engagement-rules";
import { calculateLevel, getDhakaDateKey } from "@/lib/gamification/rules";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import type { StudentClass } from "@/types";

function levelForClass(studentClass: StudentClass): FormulaLevel {
  return studentClass === "class-11" || studentClass === "class-12"
    ? "HSC"
    : "SSC";
}

function attemptSnapshot(attempt: {
  _id: unknown;
  dateKey: string;
  cardIds: string[];
  answers: Array<{ cardId: string; confidence: FormulaConfidence }>;
  status: string;
  xpEarned: number;
  startedAt: Date;
  completedAt?: Date;
}) {
  return {
    id: String(attempt._id),
    dateKey: attempt.dateKey,
    cards: attempt.cardIds
      .map((cardId) => formulaCardById(cardId))
      .filter((card) => Boolean(card)),
    answers: attempt.answers,
    status: attempt.status,
    xpEarned: attempt.xpEarned,
    confidencePercent: formulaConfidencePercent(attempt.answers),
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt ?? null,
  };
}

export async function getFormulaSprintStatus(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateKey = getDhakaDateKey(now);
  const level = levelForClass(input.studentClass);
  const [today, recent] = await Promise.all([
    FormulaSprintAttempt.findOne({
      student: input.studentId,
      dateKey,
    }).lean(),
    FormulaSprintAttempt.find({
      student: input.studentId,
      status: "completed",
    })
      .sort({ dateKey: -1 })
      .limit(30)
      .lean(),
  ]);
  const allAnswers = recent.flatMap((attempt) => attempt.answers);
  const uniqueCards = new Set(
    allAnswers.map((answer) => answer.cardId),
  ).size;

  return {
    level,
    today: today ? attemptSnapshot(today) : null,
    canStart: !today,
    availableCards: formulaCardsForLevel(level).length,
    stats: {
      completedSessions: recent.length,
      formulaStreak: calculateFormulaStreak(
        recent.map((attempt) => attempt.dateKey),
        dateKey,
      ),
      reviewedCards: uniqueCards,
      confidencePercent: formulaConfidencePercent(allAnswers),
    },
    recent: recent.slice(0, 7).map((attempt) => ({
      dateKey: attempt.dateKey,
      xpEarned: attempt.xpEarned,
      confidencePercent: formulaConfidencePercent(attempt.answers),
    })),
  };
}

export async function startFormulaSprint(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateKey = getDhakaDateKey(now);
  const existing = await FormulaSprintAttempt.findOne({
    student: input.studentId,
    dateKey,
  });
  if (existing) {
    return {
      ok: true as const,
      alreadyStarted: true,
      attempt: attemptSnapshot(existing),
    };
  }

  const level = levelForClass(input.studentClass);
  const cards = formulaCardsForLevel(level);
  const history = await FormulaSprintAttempt.find({
    student: input.studentId,
    status: "completed",
  })
    .sort({ dateKey: -1 })
    .limit(30)
    .select("dateKey answers")
    .lean();
  const cardIds = selectFormulaCardIds({
    cardIds: cards.map((card) => card.id),
    history,
    dateKey,
  });
  const attempt = await FormulaSprintAttempt.create({
    student: input.studentId,
    studentClass: input.studentClass,
    level,
    dateKey,
    cardIds,
    startedAt: now,
  });
  return {
    ok: true as const,
    alreadyStarted: false,
    attempt: attemptSnapshot(attempt),
  };
}

export async function submitFormulaSprint(input: {
  studentId: string;
  attemptId: string;
  answers: Array<{ cardId: string; confidence: FormulaConfidence }>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const attempt = await FormulaSprintAttempt.findOne({
    _id: input.attemptId,
    student: input.studentId,
  });
  if (!attempt) return { ok: false as const, reason: "not_found" as const };
  if (attempt.status === "completed") {
    return {
      ok: true as const,
      alreadyCompleted: true,
      attempt: attemptSnapshot(attempt),
      reward: { xp: attempt.xpEarned },
    };
  }

  const answerIds = input.answers.map((answer) => answer.cardId);
  const validAnswers =
    input.answers.length === attempt.cardIds.length &&
    new Set(answerIds).size === attempt.cardIds.length &&
    attempt.cardIds.every((cardId) => answerIds.includes(cardId));
  if (!validAnswers) {
    return { ok: false as const, reason: "answers" as const };
  }

  const reward = calculateFormulaSprintReward(input.answers);
  const priorCompleted = await FormulaSprintAttempt.find({
    student: input.studentId,
    status: "completed",
  })
    .select("dateKey")
    .lean();
  const formulaStreak = calculateFormulaStreak(
    [attempt.dateKey, ...priorCompleted.map((item) => item.dateKey)],
    getDhakaDateKey(now),
  );

  await getOrCreateGameProfile(input.studentId);
  const session = await mongoose.startSession();
  let alreadyCompleted = false;
  let profileSnapshot:
    | { totalXp: number; level: number; currentStreak: number }
    | undefined;
  try {
    await session.withTransaction(async () => {
      const storedAttempt = await FormulaSprintAttempt.findOne({
        _id: input.attemptId,
        student: input.studentId,
      }).session(session);
      if (!storedAttempt) throw new Error("Formula sprint is missing.");
      const profile = await StudentGameProfile.findOne({
        student: input.studentId,
      }).session(session);
      if (!profile) throw new Error("Game profile is missing.");

      if (storedAttempt.status === "completed") {
        alreadyCompleted = true;
        profileSnapshot = {
          totalXp: profile.totalXp,
          level: profile.level,
          currentStreak: profile.currentStreak,
        };
        return;
      }

      storedAttempt.answers = input.answers;
      storedAttempt.status = "completed";
      storedAttempt.xpEarned = reward.xp;
      storedAttempt.completedAt = now;
      await storedAttempt.save({ session });

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
      profile.totalXp += reward.xp;
      profile.level = calculateLevel(profile.totalXp);
      await profile.save({ session });

      const achievementCodes = ["FORMULA_STARTER"];
      if (formulaStreak >= 7) achievementCodes.push("FORMULA_WEEK");
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
        currentStreak: profile.currentStreak,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!profileSnapshot) throw new Error("Could not complete formula sprint.");
  const completedAttempt = await FormulaSprintAttempt.findById(input.attemptId);
  if (!completedAttempt) throw new Error("Completed formula sprint is missing.");
  return {
    ok: true as const,
    alreadyCompleted,
    attempt: attemptSnapshot(completedAttempt),
    reward,
    formulaStreak,
    profile: profileSnapshot,
  };
}
