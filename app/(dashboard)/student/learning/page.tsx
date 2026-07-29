import type { Metadata } from "next";

import { LearningInsightsDashboard } from "@/components/learning/LearningInsightsDashboard";

export const metadata: Metadata = {
  title: "শেখার প্ল্যান | ABSP",
  description: "ব্যক্তিগত দৈনিক প্ল্যান ও অধ্যায়ভিত্তিক দক্ষতা দেখুন।",
};

export default function StudentLearningPage() {
  return <LearningInsightsDashboard />;
}
