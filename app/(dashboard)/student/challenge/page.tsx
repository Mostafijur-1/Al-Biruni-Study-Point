import type { Metadata } from "next";

import { DailyChallengeArena } from "@/components/challenge/DailyChallengeArena";

export const metadata: Metadata = {
  title: "ডেইলি চ্যালেঞ্জ | ABSP",
  description:
    "প্রতিদিন পাঁচটি নতুন প্রশ্নের দ্রুত চ্যালেঞ্জ খেলো, সমাধান শেখো এবং XP অর্জন করো।",
};

export default function StudentChallengePage() {
  return <DailyChallengeArena />;
}
