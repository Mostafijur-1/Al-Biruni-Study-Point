import { ExamList } from "@/components/exam/ExamList";
import type { Locale } from "@/lib/i18n";

type StudentExamsPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function StudentExamsPage({ params }: StudentExamsPageProps) {
  const { locale } = await params;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Student panel</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Available Exams</h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "শুধু আপনার নিবন্ধিত শ্রেণির প্রকাশিত পরীক্ষা দেখানো হয়।"
            : "Only published exams for your registered class are shown."}
        </p>
      </div>
      <ExamList locale={locale} />
    </section>
  );
}
