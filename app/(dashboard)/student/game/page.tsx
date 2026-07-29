import type { Metadata } from "next";

import { StudentGameHub } from "@/components/gamification/StudentGameHub";

export const metadata: Metadata = {
  title: "গেম হাব | ABSP",
  description:
    "কোয়েস্ট, বিষয়ভিত্তিক লেভেল, শেখার রিওয়ার্ড ও ব্যক্তিগত অগ্রগতি দেখুন।",
};

export default function StudentGamePage() {
  return <StudentGameHub />;
}
