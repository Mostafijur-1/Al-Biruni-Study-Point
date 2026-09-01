import { Suspense } from "react";
import { McqPracticeRunner } from "@/components/exam/McqPracticeRunner";

type StudentPracticeRunnerPageProps = {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ mode?: string; count?: string; chapter?: string }>;
};

export default async function StudentPracticeRunnerPage({
  params,
  searchParams,
}: StudentPracticeRunnerPageProps) {
  const { subject } = await params;
  const { mode, count, chapter } = await searchParams;

  // Decode subject name in case it contains URL-encoded characters (like %20 for space)
  const decodedSubject = decodeURIComponent(subject);

  const parsedCount = Number(count);
  const initialQuestionCount = [10, 15, 20, 25].includes(parsedCount)
    ? parsedCount
    : undefined;

  return (
    <Suspense fallback={<p className="text-sm text-muted">লোড হচ্ছে...</p>}>
      <McqPracticeRunner
        subject={decodedSubject}
        mode={mode || "general"}
        initialQuestionCount={initialQuestionCount}
        initialChapter={chapter ? decodeURIComponent(chapter) : undefined}
      />
    </Suspense>
  );
}
