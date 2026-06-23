import { Suspense } from "react";
import { TeacherMcqReview } from "@/components/teacher/TeacherMcqReview";

export default function TeacherMcqReviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading MCQ Review...</p>}>
      <TeacherMcqReview />
    </Suspense>
  );
}

