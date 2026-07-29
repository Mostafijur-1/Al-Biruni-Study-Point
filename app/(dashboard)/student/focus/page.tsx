import type { Metadata } from "next";

import { FocusStudio } from "@/components/focus/FocusStudio";

export const metadata: Metadata = {
  title: "ফোকাস স্টুডিও | ABSP",
  description:
    "১৫, ২৫ বা ৪৫ মিনিটের মনোযোগী শেখার সেশন সম্পন্ন করুন, XP অর্জন করুন এবং ধারাবাহিকতা গড়ুন।",
};

export default function StudentFocusPage() {
  return <FocusStudio />;
}
