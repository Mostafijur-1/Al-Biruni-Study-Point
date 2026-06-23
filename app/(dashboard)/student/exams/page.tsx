import type { Metadata } from "next";
import { StudentExamsPanel } from "@/components/exam/StudentExamsPanel";

export const metadata: Metadata = {
  title: "MCQ Exams | Student Dashboard",
  description: "View and take MCQ exams assigned by your teacher.",
};

export default function StudentExamsPage() {
  return <StudentExamsPanel />;
}

