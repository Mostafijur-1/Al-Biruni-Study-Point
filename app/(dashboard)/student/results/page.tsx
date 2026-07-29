import { ResultHistory } from "@/components/exam/ResultHistory";
import { PageHeader } from "@/components/shared/PageHeader";

export default function StudentResultsPage() {
  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="শিক্ষার্থী"
        title="ফলাফল"
        description="প্র্যাকটিস ও পরীক্ষার সাম্প্রতিক ফলাফল এবং অগ্রগতি দেখুন।"
      />
      <ResultHistory />
    </section>
  );
}
