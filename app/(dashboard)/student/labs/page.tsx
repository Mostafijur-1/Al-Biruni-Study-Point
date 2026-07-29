import type { Metadata } from "next";

import { InteractiveScienceLab } from "@/components/labs/InteractiveScienceLab";

export const metadata: Metadata = {
  title: "ইন্টার‌্যাক্টিভ সায়েন্স ল্যাব | ABSP",
  description:
    "গতি, ওহমের সূত্র এবং মোলের ধারণা হাতে-কলমে পরীক্ষা করুন ও মাস্টারি XP অর্জন করুন।",
};

export default function StudentLabsPage() {
  return <InteractiveScienceLab />;
}
