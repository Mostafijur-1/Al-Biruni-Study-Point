import type { Metadata } from "next";
import { StudentExamsPanel } from "@/components/exam/StudentExamsPanel";

export const metadata: Metadata = {
  title: "MCQ Exams | Student Dashboard",
  description: "View and take MCQ exams assigned by your teacher.",
};

export default async function StudentExamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StudentExamsPanel locale={locale} />;
}
