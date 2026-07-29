import { Suspense } from "react";
import { McqPracticeRunner } from "@/components/exam/McqPracticeRunner";

type StudentPracticeRunnerPageProps = {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ mode?: string; count?: string }>;
};

export default async function StudentPracticeRunnerPage({
  params,
  searchParams,
}: StudentPracticeRunnerPageProps) {
  const { subject } = await params;
  const { mode, count } = await searchParams;

  // Decode subject name in case it contains URL-encoded characters (like %20 for space)
  const decodedSubject = decodeURIComponent(subject);

  const parsedCount = Number(count);
  const initialQuestionCount = [10, 25, 50, 100].includes(parsedCount)
    ? parsedCount
    : undefined;

  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <McqPracticeRunner
        subject={decodedSubject}
        mode={mode || "general"}
        initialQuestionCount={initialQuestionCount}
      />
    </Suspense>
  );
}
