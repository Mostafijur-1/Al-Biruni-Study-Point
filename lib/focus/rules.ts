export const FOCUS_DURATIONS = [15, 25, 45] as const;
export type FocusDuration = (typeof FOCUS_DURATIONS)[number];

export const FOCUS_INTENTIONS = {
  practice: { value: "practice", label: "MCQ অনুশীলন" },
  review: { value: "review", label: "রিভিশন" },
  lesson: { value: "lesson", label: "ভিডিও ক্লাস" },
  assignment: { value: "assignment", label: "অ্যাসাইনমেন্ট" },
} as const;
export type FocusIntention = keyof typeof FOCUS_INTENTIONS;

export const FOCUS_REFLECTIONS = {
  energized: { value: "energized", label: "দারুণ লেগেছে" },
  steady: { value: "steady", label: "মনোযোগ ধরে রেখেছি" },
  challenging: { value: "challenging", label: "কঠিন ছিল, তবু শেষ করেছি" },
} as const;
export type FocusReflection = keyof typeof FOCUS_REFLECTIONS;

export const DAILY_FOCUS_XP_CAP = 60;
export const WEEKLY_FOCUS_GOAL_MINUTES = 100;
export const FOCUS_COMPLETION_GRACE_SECONDS = 10;
export const FOCUS_COMPLETION_WINDOW_MINUTES = 120;

export function isFocusCompletionEligible(input: {
  startedAt: Date;
  durationMinutes: number;
  now: Date;
}) {
  const requiredMs = Math.max(
    0,
    input.durationMinutes * 60_000 - FOCUS_COMPLETION_GRACE_SECONDS * 1_000,
  );
  return input.now.getTime() - input.startedAt.getTime() >= requiredMs;
}

export function calculateFocusReward(input: {
  durationMinutes: number;
  xpEarnedToday: number;
}) {
  const rawXp = Math.max(0, Math.round(input.durationMinutes));
  return Math.max(
    0,
    Math.min(rawXp, DAILY_FOCUS_XP_CAP - Math.max(0, input.xpEarnedToday)),
  );
}

export function calculateFocusStreak(
  completedDateKeys: string[],
  currentDateKey: string,
) {
  const dates = [...new Set(completedDateKeys)]
    .filter((dateKey) => dateKey <= currentDateKey)
    .sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return 0;
  if (dateDifference(dates[0], currentDateKey) > 1) return 0;

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
