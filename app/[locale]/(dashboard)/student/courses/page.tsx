import { Suspense } from "react";
import { StudentClassCourses } from "@/components/content/StudentClassCourses";
import type { Locale } from "@/lib/i18n";

type StudentCoursesPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function StudentCoursesPage({ params }: StudentCoursesPageProps) {
  const { locale } = await params;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Student panel</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          {locale === "bn" ? "আমার কোর্স ও ক্লাস" : "My courses & classes"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "শুধু আপনার নিবন্ধিত শ্রেণির কন্টেন্ট দেখানো হয়।"
            : "Only content for your registered class is shown."}
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <StudentClassCourses locale={locale} />
      </Suspense>
    </section>
  );
}
