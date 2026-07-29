export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const MASTERY_CORRECT_STREAK = 3;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export function getNextReviewAt(
  reviewedAt: Date,
  isCorrect: boolean,
  correctStreak: number,
) {
  if (!isCorrect) return addDays(reviewedAt, REVIEW_INTERVAL_DAYS[0]);
  const index = Math.min(
    Math.max(0, correctStreak),
    REVIEW_INTERVAL_DAYS.length - 1,
  );
  return addDays(reviewedAt, REVIEW_INTERVAL_DAYS[index]);
}

export function isMistakeMastered(correctStreak: number) {
  return correctStreak >= MASTERY_CORRECT_STREAK;
}

export function calculateChapterMastery(input: {
  correctAnswers: number;
  attempts: number;
  lastPracticedAt?: Date;
  now?: Date;
}) {
  if (input.attempts <= 0) return 0;

  const accuracy = input.correctAnswers / input.attempts;
  const confidence = Math.min(20, input.attempts * 2);
  const now = input.now ?? new Date();
  const daysSincePractice = input.lastPracticedAt
    ? Math.floor((now.getTime() - input.lastPracticedAt.getTime()) / 86_400_000)
    : 0;
  const recencyPenalty = daysSincePractice > 30 ? 10 : daysSincePractice > 14 ? 5 : 0;

  return Math.max(
    0,
    Math.min(100, Math.round(accuracy * 80 + confidence - recencyPenalty)),
  );
}

export function masteryLabel(score: number, attempts: number) {
  if (attempts === 0) return "not_started" as const;
  if (score >= 80) return "strong" as const;
  if (score >= 60) return "improving" as const;
  return "weak" as const;
}
