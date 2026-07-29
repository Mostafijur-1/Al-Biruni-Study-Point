import type { Metadata } from "next";

import { DailyChallengeArena } from "@/components/challenge/DailyChallengeArena";

export const metadata: Metadata = {
  title: "ডেইলি চ্যালেঞ্জ | ABSP",
  description:
    "প্রতিদিন পাঁচটি নতুন প্রশ্নের দ্রুত চ্যালেঞ্জ খেলুন, সমাধান শিখুন এবং XP অর্জন করুন।",
};

export default function StudentChallengePage() {
  return <DailyChallengeArena />;
}
