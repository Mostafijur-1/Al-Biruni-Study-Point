import { ResultHistory } from "@/components/exam/ResultHistory";
import { PageHeader } from "@/components/shared/PageHeader";

export default function StudentResultsPage() {
  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="শিক্ষার্থী"
        title="আমার ফলাফল"
        description="MCQ Practice ও Exam-এর ফলাফল, উত্তরপত্র, সঠিক উত্তর এবং বিস্তারিত ব্যাখ্যা এক জায়গায় দেখুন।"
      />
      <ResultHistory />
    </section>
  );
}
