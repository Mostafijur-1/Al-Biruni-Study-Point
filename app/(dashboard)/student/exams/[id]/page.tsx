import type { Metadata } from "next";
import { McqExamRunner } from "@/components/exam/McqExamRunner";

export const metadata: Metadata = {
  title: "Take MCQ Exam",
  description: "Live exam session.",
};

export default async function StudentExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <McqExamRunner examId={id} />;
}

