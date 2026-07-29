import type { Metadata } from "next";

import { WeeklyGoalBoard } from "@/components/goals/WeeklyGoalBoard";

export const metadata: Metadata = {
  title: "সাপ্তাহিক লক্ষ্য | ABSP",
  description:
    "নিজের সাপ্তাহিক শেখার লক্ষ্য বেছে নিন, স্বয়ংক্রিয় অগ্রগতি দেখুন এবং XP অর্জন করুন।",
};

export default function StudentGoalsPage() {
  return <WeeklyGoalBoard />;
}
