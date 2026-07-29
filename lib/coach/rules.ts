export const COACH_TIME_OPTIONS = [5, 15, 30, 45] as const;
export type CoachAvailableMinutes = (typeof COACH_TIME_OPTIONS)[number];

export type CoachEnergy = "low" | "steady" | "high";
export type CoachIntent =
  | "auto"
  | "revise"
  | "practice"
  | "focus"
  | "explore";

export type CoachSignals = {
  dueMistakes: number;
  challengePending: boolean;
  formulaPending: boolean;
  weeklyGoal:
    | {
        title: string;
        href: string;
        remaining: number;
        unit: string;
      }
    | null;
  weakChapter:
    | {
        subject: string;
        chapter: string;
        score: number;
        href: string;
      }
    | null;
  nextLab:
    | {
        title: string;
        href: string;
      }
    | null;
};

export type CoachRecommendation = {
  key: string;
  title: string;
  reason: string;
  href: string;
  estimatedMinutes: number;
  category: Exclude<CoachIntent, "auto">;
  accent: "orange" | "indigo" | "violet" | "emerald" | "cyan";
};

type Candidate = CoachRecommendation & {
  priority: number;
  minimumEnergy: CoachEnergy;
};

const ENERGY_RANK: Record<CoachEnergy, number> = {
  low: 0,
  steady: 1,
  high: 2,
};

export function chooseCoachRecommendation(input: {
  availableMinutes: CoachAvailableMinutes;
  energy: CoachEnergy;
  intent: CoachIntent;
  signals: CoachSignals;
}): CoachRecommendation {
  const candidates: Candidate[] = [];
  if (input.signals.dueMistakes > 0) {
    candidates.push({
      key: "due-mistakes",
      title: `${input.signals.dueMistakes}টি ভুল আবার দেখুন`,
      reason:
        "এগুলো এখন রিভিশনের জন্য প্রস্তুত—আজ দেখলে মনে থাকার সম্ভাবনা বাড়বে।",
      href: "/student/mistakes?due=1",
      estimatedMinutes: Math.min(
        15,
        Math.max(5, Math.ceil(input.signals.dueMistakes * 0.75)),
      ),
      category: "revise",
      accent: "orange",
      priority: 95,
      minimumEnergy: "low",
    });
  }
  if (input.signals.weeklyGoal) {
    candidates.push({
      key: "weekly-goal",
      title: input.signals.weeklyGoal.title,
      reason: `সাপ্তাহিক লক্ষ্য পূরণে আর ${input.signals.weeklyGoal.remaining} ${input.signals.weeklyGoal.unit} বাকি।`,
      href: input.signals.weeklyGoal.href,
      estimatedMinutes: 10,
      category: "practice",
      accent: "emerald",
      priority: 90,
      minimumEnergy: "low",
    });
  }
  if (input.signals.challengePending) {
    candidates.push({
      key: "daily-challenge",
      title: "আজকের ডেইলি চ্যালেঞ্জ",
      reason: "মাত্র পাঁচটি প্রশ্ন—ছোট সময়ে শেখার গতি ধরে রাখার ভালো উপায়।",
      href: "/student/challenge",
      estimatedMinutes: 5,
      category: "practice",
      accent: "violet",
      priority: 85,
      minimumEnergy: "low",
    });
  }
  if (input.signals.formulaPending) {
    candidates.push({
      key: "formula-sprint",
      title: "পাঁচ কার্ডের ফর্মুলা স্প্রিন্ট",
      reason: "কম শক্তিতেও করা যায় এবং দুর্বল সূত্রগুলো আবার মনে করিয়ে দেবে।",
      href: "/student/formulas",
      estimatedMinutes: 5,
      category: "revise",
      accent: "indigo",
      priority: 80,
      minimumEnergy: "low",
    });
  }
  if (input.signals.weakChapter) {
    const weak = input.signals.weakChapter;
    candidates.push({
      key: "weak-chapter",
      title: `${weak.subject}: ${weak.chapter}`,
      reason: `এই অধ্যায়ের দক্ষতা এখন ${weak.score}%—১০টি লক্ষ্যভিত্তিক প্রশ্ন সবচেয়ে বেশি কাজে দেবে।`,
      href: weak.href,
      estimatedMinutes: 10,
      category: "practice",
      accent: "orange",
      priority: 75,
      minimumEnergy: "steady",
    });
  }
  if (input.signals.nextLab) {
    candidates.push({
      key: "science-lab",
      title: input.signals.nextLab.title,
      reason: "হাতে-কলমে মান বদলে দেখলে সূত্রের ধারণা আরও পরিষ্কার হবে।",
      href: input.signals.nextLab.href,
      estimatedMinutes: 15,
      category: "explore",
      accent: "cyan",
      priority: 65,
      minimumEnergy: "steady",
    });
  }

  const focusMinutes =
    input.availableMinutes >= 45
      ? 45
      : input.availableMinutes >= 25
        ? 25
        : 15;
  if (input.availableMinutes >= 15) {
    candidates.push({
      key: "focus-session",
      title: `${focusMinutes} মিনিটের ফোকাস সেশন`,
      reason: "একটি বিষয় বেছে নিয়ে বাধাহীনভাবে গভীর কাজ করার উপযুক্ত সময়।",
      href: "/student/focus",
      estimatedMinutes: focusMinutes,
      category: "focus",
      accent: "emerald",
      priority: 60,
      minimumEnergy: "steady",
    });
  }

  candidates.push({
    key: "quick-review",
    title: "ভুলের খাতায় দ্রুত চোখ বুলান",
    reason: "পাঁচ মিনিটের ছোট রিভিশনও শেখার ধারাবাহিকতা ধরে রাখে।",
    href: "/student/mistakes",
    estimatedMinutes: 5,
    category: "revise",
    accent: "indigo",
    priority: 30,
    minimumEnergy: "low",
  });

  const fitting = candidates.filter(
    (candidate) => candidate.estimatedMinutes <= input.availableMinutes,
  );
  const ranked = fitting
    .map((candidate) => {
      const intentScore =
        input.intent === "auto"
          ? 0
          : candidate.category === input.intent
            ? 120
            : -15;
      const energyDifference =
        ENERGY_RANK[input.energy] - ENERGY_RANK[candidate.minimumEnergy];
      const energyScore =
        energyDifference >= 0 ? 15 - energyDifference * 2 : -80;
      const timeScore = Math.round(
        (candidate.estimatedMinutes / input.availableMinutes) * 10,
      );
      return {
        candidate,
        score: candidate.priority + intentScore + energyScore + timeScore,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.candidate.priority - left.candidate.priority,
    );

  const recommendation = ranked[0]?.candidate ?? candidates[candidates.length - 1];
  return {
    key: recommendation.key,
    title: recommendation.title,
    reason: recommendation.reason,
    href: recommendation.href,
    estimatedMinutes: recommendation.estimatedMinutes,
    category: recommendation.category,
    accent: recommendation.accent,
  };
}
