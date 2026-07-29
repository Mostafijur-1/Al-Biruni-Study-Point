import mongoose from "mongoose";

import { StudentAchievement } from "@/lib/db/models/StudentAchievement";
import { StudentSubjectProgress } from "@/lib/db/models/StudentSubjectProgress";
import { SubjectProgressEvent } from "@/lib/db/models/SubjectProgressEvent";
import {
  calculateSubjectLevel,
  calculateSubjectXp,
} from "@/lib/gamification/engagement-rules";

type SubjectProgressInput = {
  studentId: string;
  attemptId: string;
  subject: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: Date;
};

function progressSnapshot(progress: {
  subject: string;
  xp: number;
  level: number;
  attempts: number;
  questionsAnswered: number;
  correctAnswers: number;
  bestAccuracy: number;
  lastAccuracy: number;
  personalBestCount: number;
}) {
  return {
    subject: progress.subject,
    xp: progress.xp,
    level: progress.level,
    attempts: progress.attempts,
    questionsAnswered: progress.questionsAnswered,
    correctAnswers: progress.correctAnswers,
    bestAccuracy: progress.bestAccuracy,
    lastAccuracy: progress.lastAccuracy,
    personalBestCount: progress.personalBestCount,
  };
}

export async function awardSubjectProgress(input: SubjectProgressInput) {
  const existingEvent = await SubjectProgressEvent.findOne({
    sourceAttempt: input.attemptId,
  }).lean();
  if (existingEvent) {
    const existingProgress = await StudentSubjectProgress.findOne({
      student: input.studentId,
      subject: input.subject,
    }).lean();
    return {
      xpEarned: existingEvent.xp,
      personalBest: existingEvent.personalBest,
      previousBest: existingEvent.previousBest,
      improvement: existingEvent.improvement,
      progress: existingProgress ? progressSnapshot(existingProgress) : null,
      alreadyAwarded: true,
    };
  }

  const session = await mongoose.startSession();
  let response:
    | {
        xpEarned: number;
        personalBest: boolean;
        previousBest: number;
        improvement: number;
        progress: ReturnType<typeof progressSnapshot>;
        alreadyAwarded: boolean;
      }
    | undefined;

  try {
    await session.withTransaction(async () => {
      const duplicate = await SubjectProgressEvent.findOne({
        sourceAttempt: input.attemptId,
      }).session(session);
      if (duplicate) {
        const progress = await StudentSubjectProgress.findOne({
          student: input.studentId,
          subject: input.subject,
        }).session(session);
        if (!progress) throw new Error("Subject progress is missing.");
        response = {
          xpEarned: duplicate.xp,
          personalBest: duplicate.personalBest,
          previousBest: duplicate.previousBest,
          improvement: duplicate.improvement,
          progress: progressSnapshot(progress),
          alreadyAwarded: true,
        };
        return;
      }

      let progress = await StudentSubjectProgress.findOne({
        student: input.studentId,
        subject: input.subject,
      }).session(session);
      const hadPreviousAttempt = Boolean(progress && progress.attempts > 0);
      const previousBest = hadPreviousAttempt ? progress!.bestAccuracy : input.percentage;
      const personalBest = hadPreviousAttempt && input.percentage > previousBest;
      const improvement = personalBest
        ? Math.round((input.percentage - previousBest) * 100) / 100
        : 0;
      const xpEarned = calculateSubjectXp({
        score: input.score,
        totalQuestions: input.totalQuestions,
        percentage: input.percentage,
        previousBest,
      });

      await SubjectProgressEvent.create(
        [{
          student: input.studentId,
          subject: input.subject,
          sourceAttempt: input.attemptId,
          xp: xpEarned,
          percentage: input.percentage,
          previousBest,
          personalBest,
          improvement,
        }],
        { session },
      );

      if (!progress) {
        [progress] = await StudentSubjectProgress.create(
          [{
            student: input.studentId,
            subject: input.subject,
            lastPracticedAt: input.submittedAt,
          }],
          { session },
        );
      }

      progress.xp += xpEarned;
      progress.level = calculateSubjectLevel(progress.xp);
      progress.attempts += 1;
      progress.questionsAnswered += input.totalQuestions;
      progress.correctAnswers += input.score;
      progress.lastAccuracy = input.percentage;
      progress.bestAccuracy = Math.max(progress.bestAccuracy, input.percentage);
      progress.personalBestCount += personalBest ? 1 : 0;
      progress.lastPracticedAt = input.submittedAt;
      await progress.save({ session });

      const achievementCodes: string[] = [];
      if (progress.level >= 3) achievementCodes.push("SUBJECT_SPECIALIST");
      if (personalBest && improvement >= 15) achievementCodes.push("COMEBACK");
      for (const code of achievementCodes) {
        await StudentAchievement.updateOne(
          { student: input.studentId, code },
          {
            $setOnInsert: {
              student: input.studentId,
              code,
              sourceAttempt: input.attemptId,
              unlockedAt: input.submittedAt,
            },
          },
          { upsert: true, session },
        );
      }

      response = {
        xpEarned,
        personalBest,
        previousBest,
        improvement,
        progress: progressSnapshot(progress),
        alreadyAwarded: false,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!response) throw new Error("Could not update subject progress.");
  return response;
}
