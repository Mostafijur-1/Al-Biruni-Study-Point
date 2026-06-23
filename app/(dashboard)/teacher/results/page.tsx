import type { Metadata } from "next";
import { TeacherResultsDashboard } from "@/components/teacher/TeacherResultsDashboard";

export const metadata: Metadata = {
  title: "Student Results | Teacher Dashboard",
  description: "View your students' MCQ practice results and identify weak areas.",
};

export default function TeacherResultsPage() {
  return <TeacherResultsDashboard />;
}

