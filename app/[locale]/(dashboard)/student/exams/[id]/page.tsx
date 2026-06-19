import type { Metadata } from "next";
import { McqExamRunner } from "@/components/exam/McqExamRunner";

export const metadata: Metadata = {
  title: "Take MCQ Exam",
  description: "Live exam session.",
};

export default async function StudentExamDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <McqExamRunner locale={locale} examId={id} />;
}
