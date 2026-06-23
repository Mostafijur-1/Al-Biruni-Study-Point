import type { Metadata } from "next";
import { TeacherExamsPanel } from "@/components/teacher/TeacherExamsPanel";

export const metadata: Metadata = {
  title: "MCQ Exams | Teacher Dashboard",
  description: "Create and manage MCQ exams for your students.",
};

export default function TeacherExamsPage() {
  return <TeacherExamsPanel />;
}

