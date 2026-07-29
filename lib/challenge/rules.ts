export const DAILY_CHALLENGE_QUESTION_COUNT = 5;
export const DAILY_CHALLENGE_DURATION_SECONDS = 90;

export function calculateDailyChallengeReward(input: {
  score: number;
  totalQuestions: number;
  timeTakenSeconds: number;
}) {
  if (input.totalQuestions <= 0) {
    return {
      xp: 0,
      breakdown: { completion: 0, correctAnswers: 0, speed: 0, perfect: 0 },
    };
  }
  const breakdown = {
    completion: 10,
    correctAnswers: Math.max(0, input.score) * 4,
    speed: input.timeTakenSeconds <= 45 ? 10 : 0,
    perfect: input.score === input.totalQuestions ? 10 : 0,
  };
  return {
    xp:
      breakdown.completion +
      breakdown.correctAnswers +
      breakdown.speed +
      breakdown.perfect,
    breakdown,
  };
}

export function calculateChallengeStreak(
  submittedDateKeys: string[],
  currentDateKey: string,
) {
  const dates = [...new Set(submittedDateKeys)]
    .filter((dateKey) => dateKey <= currentDateKey)
    .sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return 0;

  const newestGap = dateDifference(dates[0], currentDateKey);
  if (newestGap > 1) return 0;

  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (dateDifference(dates[index], dates[index - 1]) !== 1) break;
    streak += 1;
  }
  return streak;
}

function dateDifference(previousDateKey: string, currentDateKey: string) {
  const previous = Date.parse(`${previousDateKey}T00:00:00Z`);
  const current = Date.parse(`${currentDateKey}T00:00:00Z`);
  return Math.round((current - previous) / 86_400_000);
}
