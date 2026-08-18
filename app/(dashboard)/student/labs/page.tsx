import type { Metadata } from "next";

import { InteractiveScienceLab } from "@/components/labs/InteractiveScienceLab";

export const metadata: Metadata = {
  title: "ইন্টার‌্যাক্টিভ STEM ল্যাব | ABSP",
  description:
    "বিষয় ও অধ্যায় ধরে 3D-অনুপ্রাণিত পদার্থবিজ্ঞান, রসায়ন, উচ্চতর গণিত ও আইসিটি সিমুলেশন চালিয়ে ব্যবহারিকভাবে শেখো।",
};

export default function StudentLabsPage() {
  return <InteractiveScienceLab />;
}
