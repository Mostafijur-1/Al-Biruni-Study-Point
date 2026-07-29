import { getDailyChallengeStatus } from "@/lib/challenge/service";
import {
  chooseCoachRecommendation,
  type CoachAvailableMinutes,
  type CoachEnergy,
  type CoachIntent,
  type CoachSignals,
} from "@/lib/coach/rules";
import { MistakeReview } from "@/lib/db/models/MistakeReview";
import { StudentCoachCheckIn } from "@/lib/db/models/StudentCoachCheckIn";
import { getFormulaSprintStatus } from "@/lib/formulas/service";
import { getDhakaDateKey } from "@/lib/gamification/rules";
import { getWeeklyGoalBoard } from "@/lib/goals/service";
import { getScienceLabHub } from "@/lib/labs/service";
import { getStudentMastery } from "@/lib/learning/mastery-service";
import type { StudentClass } from "@/types";

function checkInSnapshot(checkIn: {
  _id: unknown;
  dateKey: string;
  availableMinutes: number;
  energy: string;
  intent: string;
  recommendation: {
    key: string;
    title: string;
    reason: string;
    href: string;
    estimatedMinutes: number;
    category: string;
    accent: string;
  };
  launchedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(checkIn._id),
    dateKey: checkIn.dateKey,
    availableMinutes: checkIn.availableMinutes,
    energy: checkIn.energy,
    intent: checkIn.intent,
    recommendation: checkIn.recommendation,
    launchedAt: checkIn.launchedAt ?? null,
    createdAt: checkIn.createdAt,
    updatedAt: checkIn.updatedAt,
  };
}

async function getCoachSignals(input: {
  studentId: string;
  studentClass: StudentClass;
  now: Date;
}): Promise<CoachSignals> {
  const [
    dueMistakes,
    challenge,
    formulas,
    goals,
    labs,
    mastery,
  ] = await Promise.all([
    MistakeReview.countDocuments({
      student: input.studentId,
      status: "active",
      nextReviewAt: { $lte: input.now },
    }),
    getDailyChallengeStatus(input),
    getFormulaSprintStatus(input),
    getWeeklyGoalBoard(input),
    getScienceLabHub(input.studentId),
    getStudentMastery(input.studentId, input.studentClass),
  ]);
  const weeklyGoal =
    goals.current && !goals.current.complete
      ? {
          title: goals.current.subject
            ? `${goals.current.subject}: ${goals.current.label}`
            : goals.current.label,
          href: goals.current.href,
          remaining: Math.max(
            0,
            goals.current.target - goals.current.rawProgress,
          ),
          unit: goals.current.unit,
        }
      : null;
  const weakChapter = mastery.recommendation
    ? {
        subject: mastery.recommendation.subject,
        chapter: mastery.recommendation.chapter,
        score: mastery.recommendation.score,
        href: "/student/practice",
      }
    : null;
  const nextLab = labs.labs.find((lab) => !lab.completed);

  return {
    dueMistakes,
    challengePending:
      challenge.available && challenge.status !== "submitted",
    formulaPending: formulas.today?.status !== "completed",
    weeklyGoal,
    weakChapter,
    nextLab: nextLab
      ? {
          title: nextLab.title,
          href: "/student/labs",
        }
      : null,
  };
}

export async function getStudyCoachStatus(input: {
  studentId: string;
  studentClass: StudentClass;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateKey = getDhakaDateKey(now);
  const [checkIn, signals] = await Promise.all([
    StudentCoachCheckIn.findOne({
      student: input.studentId,
      dateKey,
    }).lean(),
    getCoachSignals({
      studentId: input.studentId,
      studentClass: input.studentClass,
      now,
    }),
  ]);
  return {
    dateKey,
    current: checkIn ? checkInSnapshot(checkIn) : null,
    signals: {
      dueMistakes: signals.dueMistakes,
      challengePending: signals.challengePending,
      formulaPending: signals.formulaPending,
      weeklyGoal: signals.weeklyGoal
        ? {
            title: signals.weeklyGoal.title,
            remaining: signals.weeklyGoal.remaining,
            unit: signals.weeklyGoal.unit,
          }
        : null,
      weakChapter: signals.weakChapter
        ? {
            subject: signals.weakChapter.subject,
            chapter: signals.weakChapter.chapter,
            score: signals.weakChapter.score,
          }
        : null,
      labsRemaining: signals.nextLab ? 1 : 0,
    },
  };
}

export async function createStudyCoachCheckIn(input: {
  studentId: string;
  studentClass: StudentClass;
  availableMinutes: CoachAvailableMinutes;
  energy: CoachEnergy;
  intent: CoachIntent;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateKey = getDhakaDateKey(now);
  const signals = await getCoachSignals({
    studentId: input.studentId,
    studentClass: input.studentClass,
    now,
  });
  const recommendation = chooseCoachRecommendation({
    availableMinutes: input.availableMinutes,
    energy: input.energy,
    intent: input.intent,
    signals,
  });
  const checkIn = await StudentCoachCheckIn.findOneAndUpdate(
    { student: input.studentId, dateKey },
    {
      $set: {
        availableMinutes: input.availableMinutes,
        energy: input.energy,
        intent: input.intent,
        recommendation,
      },
      $unset: { launchedAt: "" },
      $setOnInsert: {
        student: input.studentId,
        dateKey,
      },
    },
    { upsert: true, new: true },
  );
  return {
    checkIn: checkInSnapshot(checkIn),
    signals,
  };
}

export async function launchStudyCoachRecommendation(input: {
  studentId: string;
  checkInId: string;
  now?: Date;
}) {
  const checkIn = await StudentCoachCheckIn.findOne({
    _id: input.checkInId,
    student: input.studentId,
  });
  if (!checkIn) return null;
  if (!checkIn.recommendation.href.startsWith("/student/")) {
    throw new Error("Coach recommendation destination is invalid.");
  }
  checkIn.launchedAt = input.now ?? new Date();
  await checkIn.save();
  return {
    href: checkIn.recommendation.href,
    checkIn: checkInSnapshot(checkIn),
  };
}
