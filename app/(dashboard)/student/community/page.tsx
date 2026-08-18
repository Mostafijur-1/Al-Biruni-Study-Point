import type { Metadata } from "next";

import { StudentCommunityHub } from "@/components/community/StudentCommunityHub";

export const metadata: Metadata = {
  title: "ক্লাস কমিউনিটি | ABSP",
  description:
    "সহপাঠীদের সঙ্গে সাপ্তাহিক শেখার লক্ষ্য পূরণ করো এবং নিরাপদ উৎসাহ বিনিময় করো।",
};

export default function StudentCommunityPage() {
  return <StudentCommunityHub />;
}
