import { getDhakaDateKey } from "./rules.ts";

export const SUBJECT_XP_PER_LEVEL = 250;

export type QuestPeriod = "daily" | "weekly";
export type QuestMetric =
  | "questions"
  | "mistake_reviews"
  | "lessons"
  | "active_days"
  | "subjects"
  | "improvement";

export type QuestDefinition = {
  code: string;
  period: QuestPeriod;
  metric: QuestMetric;
  title: string;
  description: string;
  target: number;
  xp: number;
  streakFreezes: number;
  href: string;
};

export const QUESTS: QuestDefinition[] = [
  {
    code: "DAILY_QUESTIONS_10",
    period: "daily",
    metric: "questions",
    title: "আজকের ১০ প্রশ্ন",
    description: "যেকোনো বিষয়ে ১০টি প্রশ্নের উত্তর দিন।",
    target: 10,
    xp: 20,
    streakFreezes: 0,
    href: "/student/practice",
  },
  {
    code: "DAILY_REVIEW_3",
    period: "daily",
    metric: "mistake_reviews",
    title: "ভুল থেকে শেখা",
    description: "ভুলের খাতার ৩টি প্রশ্ন রিভিশন করুন।",
    target: 3,
    xp: 15,
    streakFreezes: 0,
    href: "/student/mistakes?due=1",
  },
  {
    code: "DAILY_LESSON_1",
    period: "daily",
    metric: "lessons",
    title: "একটি ক্লাস সম্পন্ন",
    description: "আজ একটি ভিডিও ক্লাস শেষ করুন।",
    target: 1,
    xp: 20,
    streakFreezes: 0,
    href: "/student/courses",
  },
  {
    code: "WEEKLY_QUESTIONS_100",
    period: "weekly",
    metric: "questions",
    title: "সাপ্তাহিক সেঞ্চুরি",
    description: "এই সপ্তাহে ১০০টি প্রশ্নের উত্তর দিন।",
    target: 100,
    xp: 80,
    streakFreezes: 1,
    href: "/student/practice",
  },
  {
    code: "WEEKLY_ACTIVE_4",
    period: "weekly",
    metric: "active_days",
    title: "চার দিনের ধারাবাহিকতা",
    description: "এই সপ্তাহে অন্তত ৪ দিন অনুশীলন করুন।",
    target: 4,
    xp: 60,
    streakFreezes: 0,
    href: "/student/practice",
  },
  {
    code: "WEEKLY_SUBJECTS_3",
    period: "weekly",
    metric: "subjects",
    title: "তিন বিষয়ের অভিযান",
    description: "এই সপ্তাহে ৩টি আলাদা বিষয় অনুশীলন করুন।",
    target: 3,
    xp: 50,
    streakFreezes: 0,
    href: "/student/learning",
  },
  {
    code: "WEEKLY_IMPROVEMENT_10",
    period: "weekly",
    metric: "improvement",
    title: "নিজেকেই ছাড়িয়ে যান",
    description: "একই বিষয়ে আগের ফলের চেয়ে ১০% উন্নতি করুন।",
    target: 10,
    xp: 70,
    streakFreezes: 0,
    href: "/student/learning",
  },
];

export const PROFILE_FRAMES = [
  { id: "classic", title: "ক্লাসিক", requiredLevel: 1 },
  { id: "scholar", title: "স্কলার নীল", requiredLevel: 3 },
  { id: "champion", title: "চ্যাম্পিয়ন সোনা", requiredLevel: 5 },
  { id: "cosmic", title: "কসমিক", requiredLevel: 8 },
] as const;

export const HUB_THEMES = [
  { id: "classic", title: "ABSP ক্লাসিক", requiredLevel: 1 },
  { id: "ocean", title: "সায়েন্স ওশান", requiredLevel: 4 },
  { id: "sunset", title: "সানসেট এনার্জি", requiredLevel: 7 },
] as const;

export function calculateSubjectXp(input: {
  score: number;
  totalQuestions: number;
  percentage: number;
  previousBest: number;
}) {
  const correctXp = Math.max(0, input.score) * 4;
  const completionXp = input.totalQuestions > 0 ? 10 : 0;
  const improvement = Math.max(0, Math.round(input.percentage - input.previousBest));
  const improvementXp = Math.min(20, improvement);
  return correctXp + completionXp + improvementXp;
}

export function calculateSubjectLevel(xp: number) {
  return Math.floor(Math.max(0, xp) / SUBJECT_XP_PER_LEVEL) + 1;
}

export function getDhakaDayBounds(date = new Date()) {
  const dateKey = getDhakaDateKey(date);
  return {
    key: dateKey,
    start: new Date(`${dateKey}T00:00:00+06:00`),
    end: new Date(`${dateKey}T23:59:59.999+06:00`),
  };
}

export function getDhakaWeekBounds(date = new Date()) {
  const dateKey = getDhakaDateKey(date);
  const utcDate = new Date(`${dateKey}T00:00:00Z`);
  const day = utcDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(utcDate);
  monday.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const startKey = monday.toISOString().slice(0, 10);
  const endKey = sunday.toISOString().slice(0, 10);
  return {
    key: startKey,
    start: new Date(`${startKey}T00:00:00+06:00`),
    end: new Date(`${endKey}T23:59:59.999+06:00`),
  };
}

export function leaderboardScore(input: {
  activeDays: number;
  questions: number;
  improvement: number;
}) {
  return (
    Math.max(0, input.activeDays) * 40 +
    Math.max(0, input.questions) +
    Math.max(0, Math.round(input.improvement)) * 2
  );
}

export function resolveStreakUpdate(input: {
  currentStreak: number;
  lastQualifiedDate?: string;
  currentDateKey: string;
  streakFreezes: number;
}) {
  if (!input.lastQualifiedDate) {
    return {
      currentStreak: 1,
      streakFreezes: input.streakFreezes,
      streakFreezeUsed: false,
    };
  }

  const previous = Date.parse(`${input.lastQualifiedDate}T00:00:00Z`);
  const current = Date.parse(`${input.currentDateKey}T00:00:00Z`);
  const difference = Math.round((current - previous) / 86_400_000);

  if (difference <= 0) {
    return {
      currentStreak: input.currentStreak,
      streakFreezes: input.streakFreezes,
      streakFreezeUsed: false,
    };
  }
  if (difference === 1) {
    return {
      currentStreak: input.currentStreak + 1,
      streakFreezes: input.streakFreezes,
      streakFreezeUsed: false,
    };
  }
  if (difference === 2 && input.streakFreezes > 0) {
    return {
      currentStreak: input.currentStreak + 1,
      streakFreezes: input.streakFreezes - 1,
      streakFreezeUsed: true,
    };
  }
  return {
    currentStreak: 1,
    streakFreezes: input.streakFreezes,
    streakFreezeUsed: false,
  };
}

export function visibleStreak(input: {
  currentStreak: number;
  lastQualifiedDate?: string;
  currentDateKey: string;
  streakFreezes: number;
}) {
  if (!input.lastQualifiedDate) return input.currentStreak;
  const previous = Date.parse(`${input.lastQualifiedDate}T00:00:00Z`);
  const current = Date.parse(`${input.currentDateKey}T00:00:00Z`);
  const difference = Math.round((current - previous) / 86_400_000);
  return difference <= 1 || (difference === 2 && input.streakFreezes > 0)
    ? input.currentStreak
    : 0;
}
