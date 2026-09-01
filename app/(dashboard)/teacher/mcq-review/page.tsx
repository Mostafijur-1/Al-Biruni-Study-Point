import { Suspense } from "react";
import { TeacherMcqReview } from "@/components/teacher/TeacherMcqReview";

export default function TeacherMcqReviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">MCQ Review লোড হচ্ছে...</p>}>
      <TeacherMcqReview />
    </Suspense>
  );
}
