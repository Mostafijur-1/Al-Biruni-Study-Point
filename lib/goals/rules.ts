export type WeeklyGoalMetric =
  | "practice_questions"
  | "focus_minutes"
  | "challenge_days";

export type WeeklyGoalTarget = {
  target: number;
  xp: number;
  label: string;
};

export type WeeklyGoalDefinition = {
  metric: WeeklyGoalMetric;
  label: string;
  description: string;
  unit: string;
  href: string;
  supportsSubject: boolean;
  targets: readonly WeeklyGoalTarget[];
};

export const WEEKLY_GOAL_DEFINITIONS: Record<
  WeeklyGoalMetric,
  WeeklyGoalDefinition
> = {
  practice_questions: {
    metric: "practice_questions",
    label: "প্রশ্ন অনুশীলন",
    description: "এই সপ্তাহে নির্বাচিত বিষয়ের MCQ প্রশ্নের উত্তর দিন।",
    unit: "প্রশ্ন",
    href: "/student/practice",
    supportsSubject: true,
    targets: [
      { target: 30, xp: 30, label: "সহজ শুরু" },
      { target: 60, xp: 45, label: "নিয়মিত" },
      { target: 100, xp: 70, label: "চ্যালেঞ্জ" },
    ],
  },
  focus_minutes: {
    metric: "focus_minutes",
    label: "ফোকাস সময়",
    description: "ফোকাস স্টুডিওতে মনোযোগী পড়ার সময় সম্পন্ন করুন।",
    unit: "মিনিট",
    href: "/student/focus",
    supportsSubject: true,
    targets: [
      { target: 45, xp: 30, label: "সহজ শুরু" },
      { target: 100, xp: 50, label: "নিয়মিত" },
      { target: 180, xp: 75, label: "চ্যালেঞ্জ" },
    ],
  },
  challenge_days: {
    metric: "challenge_days",
    label: "চ্যালেঞ্জ ধারাবাহিকতা",
    description: "আলাদা দিনে ডেইলি চ্যালেঞ্জ সম্পন্ন করুন।",
    unit: "দিন",
    href: "/student/challenge",
    supportsSubject: false,
    targets: [
      { target: 3, xp: 30, label: "সহজ শুরু" },
      { target: 5, xp: 50, label: "নিয়মিত" },
      { target: 7, xp: 80, label: "চ্যালেঞ্জ" },
    ],
  },
};

export const WEEKLY_GOAL_METRICS = Object.keys(
  WEEKLY_GOAL_DEFINITIONS,
) as WeeklyGoalMetric[];

export function getWeeklyGoalDefinition(metric: WeeklyGoalMetric) {
  return WEEKLY_GOAL_DEFINITIONS[metric];
}

export function getWeeklyGoalReward(
  metric: WeeklyGoalMetric,
  target: number,
) {
  return (
    WEEKLY_GOAL_DEFINITIONS[metric].targets.find(
      (option) => option.target === target,
    )?.xp ?? null
  );
}

export function goalProgressPercent(progress: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress / target) * 100)));
}

export function isWeeklyGoalComplete(progress: number, target: number) {
  return target > 0 && progress >= target;
}

export function isStretchWeeklyGoal(
  metric: WeeklyGoalMetric,
  target: number,
) {
  const options = WEEKLY_GOAL_DEFINITIONS[metric].targets;
  return options[options.length - 1]?.target === target;
}
