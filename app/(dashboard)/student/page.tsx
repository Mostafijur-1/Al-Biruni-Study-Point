import type { Metadata } from "next";

import { StudentHomeDashboard } from "@/components/student/StudentHomeDashboard";

export const metadata: Metadata = {
  title: "শিক্ষার্থী ড্যাশবোর্ড | ABSP",
  description: "আজকের শেখার লক্ষ্য, পরীক্ষা, অ্যাসাইনমেন্ট ও অগ্রগতি একসাথে দেখুন।",
};

export default function StudentDashboardPage() {
  return <StudentHomeDashboard />;
}
