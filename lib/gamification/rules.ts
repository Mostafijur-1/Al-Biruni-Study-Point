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
    title: "প্রথম পদক্ষেপ",
    description: "প্রথম MCQ অনুশীলন সম্পন্ন করুন।",
  },
  THREE_DAY_STREAK: {
    code: "THREE_DAY_STREAK",
    title: "টানা তিন দিন",
    description: "তিন দিনের শেখার ধারাবাহিকতা বজায় রাখুন।",
  },
  HUNDRED_QUESTIONS: {
    code: "HUNDRED_QUESTIONS",
    title: "প্রশ্নের সেঞ্চুরি",
    description: "১০০টি অনুশীলনী প্রশ্নের উত্তর দিন।",
  },
  SHARP_SHOOTER: {
    code: "SHARP_SHOOTER",
    title: "দারুণ নিশানা",
    description: "১০ প্রশ্নের অনুশীলনে অন্তত ৮০% নম্বর পান।",
  },
  PERFECT_SCORE: {
    code: "PERFECT_SCORE",
    title: "নিখুঁত স্কোর",
    description: "একটি অনুশীলনের সব প্রশ্নের সঠিক উত্তর দিন।",
  },
  SEVEN_DAY_STREAK: {
    code: "SEVEN_DAY_STREAK",
    title: "সাত দিনের অগ্রযাত্রা",
    description: "টানা সাত দিন শেখার লক্ষ্য পূরণ করুন।",
  },
  FIVE_HUNDRED_QUESTIONS: {
    code: "FIVE_HUNDRED_QUESTIONS",
    title: "প্রশ্নযোদ্ধা",
    description: "৫০০টি অনুশীলনী প্রশ্নের উত্তর দিন।",
  },
  SUBJECT_SPECIALIST: {
    code: "SUBJECT_SPECIALIST",
    title: "বিষয় বিশেষজ্ঞ",
    description: "যেকোনো একটি বিষয়ে লেভেল ৩ অর্জন করুন।",
  },
  COMEBACK: {
    code: "COMEBACK",
    title: "দারুণ প্রত্যাবর্তন",
    description: "একটি বিষয়ে নিজের সেরা ফল অন্তত ১৫% বাড়ান।",
  },
  QUEST_MASTER: {
    code: "QUEST_MASTER",
    title: "কোয়েস্ট মাস্টার",
    description: "একটি সাপ্তাহিক কোয়েস্ট সম্পন্ন করে পুরস্কার নিন।",
  },
  TEAM_PLAYER: {
    code: "TEAM_PLAYER",
    title: "টিম প্লেয়ার",
    description: "সহপাঠীদের সঙ্গে একটি ক্লাস মিশন সম্পন্ন করুন।",
  },
  DAILY_CHALLENGER: {
    code: "DAILY_CHALLENGER",
    title: "দৈনিক চ্যালেঞ্জার",
    description: "প্রথম দৈনিক চ্যালেঞ্জ সম্পন্ন করুন।",
  },
  CHALLENGE_ACE: {
    code: "CHALLENGE_ACE",
    title: "চ্যালেঞ্জ এস",
    description: "একটি দৈনিক চ্যালেঞ্জে সব প্রশ্নের সঠিক উত্তর দিন।",
  },
  CHALLENGE_WEEK: {
    code: "CHALLENGE_WEEK",
    title: "সাত দিনের চ্যালেঞ্জ",
    description: "টানা সাত দিন দৈনিক চ্যালেঞ্জ সম্পন্ন করুন।",
  },
  FOCUS_STARTER: {
    code: "FOCUS_STARTER",
    title: "ফোকাস শুরু",
    description: "প্রথম ফোকাস সেশন সম্পন্ন করুন।",
  },
  DEEP_FOCUS: {
    code: "DEEP_FOCUS",
    title: "ডিপ ফোকাস",
    description: "একটি ৪৫ মিনিটের ফোকাস সেশন সম্পন্ন করুন।",
  },
  FOCUS_CENTURY: {
    code: "FOCUS_CENTURY",
    title: "ফোকাস সেঞ্চুরি",
    description: "এক সপ্তাহে ১০০ মিনিট মনোযোগ দিয়ে পড়ুন।",
  },
  GOAL_GETTER: {
    code: "GOAL_GETTER",
    title: "লক্ষ্যজয়ী",
    description: "নিজের প্রথম সাপ্তাহিক লক্ষ্য সম্পন্ন করুন।",
  },
  GOAL_CHAMPION: {
    code: "GOAL_CHAMPION",
    title: "লক্ষ্য চ্যাম্পিয়ন",
    description: "একটি কঠিন সাপ্তাহিক লক্ষ্য সম্পন্ন করুন।",
  },
  LAB_EXPLORER: {
    code: "LAB_EXPLORER",
    title: "তরুণ গবেষক",
    description: "প্রথম ইন্টার‌্যাক্টিভ সায়েন্স ল্যাব সম্পন্ন করুন।",
  },
  LAB_MASTER: {
    code: "LAB_MASTER",
    title: "ল্যাব মাস্টার",
    description: "সব ইন্টার‌্যাক্টিভ সায়েন্স ল্যাব সম্পন্ন করুন।",
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
  if (input.currentStreak >= 7) codes.push("SEVEN_DAY_STREAK");
  if (input.totalQuestionsAnswered >= 100) codes.push("HUNDRED_QUESTIONS");
  if (input.totalQuestionsAnswered >= 500) codes.push("FIVE_HUNDRED_QUESTIONS");
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
