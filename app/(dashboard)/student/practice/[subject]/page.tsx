import { Suspense } from "react";
import { McqPracticeRunner } from "@/components/exam/McqPracticeRunner";

type StudentPracticeRunnerPageProps = {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function StudentPracticeRunnerPage({
  params,
  searchParams,
}: StudentPracticeRunnerPageProps) {
  const { subject } = await params;
  const { mode } = await searchParams;

  // Decode subject name in case it contains URL-encoded characters (like %20 for space)
  const decodedSubject = decodeURIComponent(subject);

  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <McqPracticeRunner subject={decodedSubject} mode={mode || "general"} />
    </Suspense>
  );
}

