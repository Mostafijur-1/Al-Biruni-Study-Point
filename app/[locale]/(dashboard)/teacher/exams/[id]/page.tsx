import type { Metadata } from "next";
import { TeacherExamDetailPanel } from "@/components/teacher/TeacherExamDetailPanel";

export const metadata: Metadata = {
  title: "Exam Details | Teacher Dashboard",
  description: "View exam details, manage questions, and review student grades.",
};

export default async function TeacherExamDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <TeacherExamDetailPanel locale={locale} examId={id} />;
}
