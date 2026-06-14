import { Suspense } from "react";
import { TeacherMcqReview } from "@/components/teacher/TeacherMcqReview";

type TeacherMcqReviewPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TeacherMcqReviewPage({
  params,
}: TeacherMcqReviewPageProps) {
  const { locale } = await params;

  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading MCQ Review...</p>}>
      <TeacherMcqReview locale={locale} />
    </Suspense>
  );
}
