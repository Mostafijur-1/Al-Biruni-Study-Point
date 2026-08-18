import type { Metadata } from "next";

import { SmartStudyCoach } from "@/components/coach/SmartStudyCoach";

export const metadata: Metadata = {
  title: "স্মার্ট স্টাডি কোচ | ABSP",
  description:
    "সময়, শক্তি ও শেখার অগ্রগতি অনুযায়ী আজকের সবচেয়ে কার্যকর পরবর্তী পড়ার কাজটি বেছে নাও।",
};

export default function StudentCoachPage() {
  return <SmartStudyCoach />;
}
