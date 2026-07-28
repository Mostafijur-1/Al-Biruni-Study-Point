export const DAILY_XP_CAP = 120;
export const XP_PER_LEVEL = 100;
export const DEFAULT_DAILY_GOAL = 10;

export type PracticeRewardInput = {
  score: number;
  totalQuestions: number;
  answeredCount: number;
  isCancelled: boolean;
};

export type XpBreakdown = {
  correctAnswers: number;
  completion: number;
  accuracy: number;
};

export const ACHIEVEMENTS = {
  FIRST_TEST: {
    code: "FIRST_TEST",
    title: "First Step",
    description: "Complete your first MCQ practice test.",
  },
  THREE_DAY_STREAK: {
    code: "THREE_DAY_STREAK",
    title: "On a Roll",
    description: "Maintain a three-day learning streak.",
  },
  HUNDRED_QUESTIONS: {
    code: "HUNDRED_QUESTIONS",
    title: "Century",
    description: "Answer 100 practice questions.",
  },
  SHARP_SHOOTER: {
    code: "SHARP_SHOOTER",
    title: "Sharp Shooter",
    description: "Score at least 80% in a 10-question practice test.",
  },
  PERFECT_SCORE: {
    code: "PERFECT_SCORE",
    title: "Perfect Score",
    description: "Answer every question correctly in a practice test.",
  },
} as const;

export type AchievementCode = keyof typeof ACHIEVEMENTS;

export function calculateLevel(totalXp: number) {
  return Math.floor(Math.max(0, totalXp) / XP_PER_LEVEL) + 1;
}

export function calculatePracticeReward(input: PracticeRewardInput) {
  if (input.isCancelled || input.totalQuestions <= 0) {
    return {
      qualifiedDay: false,
      rawXp: 0,
      breakdown: { correctAnswers: 0, completion: 0, accuracy: 0 },
    };
  }

  const percentage = (input.score / input.totalQuestions) * 100;
  const breakdown: XpBreakdown = {
    correctAnswers: Math.max(0, input.score) * 2,
    completion: input.answeredCount === input.totalQuestions ? 10 : 0,
    accuracy: percentage >= 80 ? 10 : percentage >= 60 ? 5 : 0,
  };

  return {
    qualifiedDay: input.answeredCount >= DEFAULT_DAILY_GOAL,
    rawXp: breakdown.correctAnswers + breakdown.completion + breakdown.accuracy,
    breakdown,
  };
}

export function getDhakaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function differenceInDateKeys(previousDateKey: string, currentDateKey: string) {
  const previous = Date.parse(`${previousDateKey}T00:00:00Z`);
  const current = Date.parse(`${currentDateKey}T00:00:00Z`);
  return Math.round((current - previous) / 86_400_000);
}

export function getEarnedAchievementCodes(input: {
  testsCompleted: number;
  totalQuestionsAnswered: number;
  currentStreak: number;
  score: number;
  totalQuestions: number;
  answeredCount: number;
}) {
  const codes: AchievementCode[] = [];
  if (input.testsCompleted >= 1) codes.push("FIRST_TEST");
  if (input.currentStreak >= 3) codes.push("THREE_DAY_STREAK");
  if (input.totalQuestionsAnswered >= 100) codes.push("HUNDRED_QUESTIONS");
  if (
    input.totalQuestions >= 10 &&
    input.score / input.totalQuestions >= 0.8
  ) {
    codes.push("SHARP_SHOOTER");
  }
  if (
    input.totalQuestions > 0 &&
    input.answeredCount === input.totalQuestions &&
    input.score === input.totalQuestions
  ) {
    codes.push("PERFECT_SCORE");
  }
  return codes;
}
