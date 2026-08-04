import type { Metadata } from "next";

import { TimetableWorkspace } from "@/components/TimetableWorkspace";

export const metadata: Metadata = {
  title: "একাডেমিক রুটিন | ABSP Admin",
  description: "ব্যাচ, শিক্ষক অ্যাসাইনমেন্ট, রুটিন ও ক্লাস সেশন পরিচালনা।",
};

export default function AdminAcademicPage() {
  return <TimetableWorkspace role="admin" />;
}
