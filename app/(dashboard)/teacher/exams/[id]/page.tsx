import type { Metadata } from "next";
import { TeacherExamDetailPanel } from "@/components/teacher/TeacherExamDetailPanel";

export const metadata: Metadata = {
  title: "Exam Details | Teacher Dashboard",
  description: "View exam details, manage questions, and review student grades.",
};

export default async function TeacherExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherExamDetailPanel examId={id} />;
}

