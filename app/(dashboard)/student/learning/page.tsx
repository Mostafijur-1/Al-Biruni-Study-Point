import type { Metadata } from "next";

import { LearningInsightsDashboard } from "@/components/learning/LearningInsightsDashboard";

export const metadata: Metadata = {
  title: "শেখার প্ল্যাও | ABSP",
  description: "ব্যক্তিগত দৈনিক প্ল্যাও ও অধ্যায়ভিত্তিক দক্ষতা দেখো।",
};

export default function StudentLearningPage() {
  return <LearningInsightsDashboard />;
}
