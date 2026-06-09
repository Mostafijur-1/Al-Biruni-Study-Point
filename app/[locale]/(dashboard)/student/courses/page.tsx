import { Suspense } from "react";
import Link from "next/link";
import { StudentClassCourses } from "@/components/content/StudentClassCourses";
import type { Locale } from "@/lib/i18n";

type StudentCoursesPageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ level?: string }>;
};

export default async function StudentCoursesPage({ params, searchParams }: StudentCoursesPageProps) {
  const { locale } = await params;
  const { level: rawLevel } = await searchParams;
  const level = rawLevel === "HSC" ? "HSC" : "SSC";
  const otherLevel = level === "SSC" ? "HSC" : "SSC";
  const otherLevelHref = `/${locale}/student/courses?level=${otherLevel}`;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Student panel</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-primary">
            {locale === "bn" ? "আমার কোর্স ও ক্লাস" : "My courses & classes"}
          </h1>
          <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
            {level}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            {locale === "bn"
              ? "শুধু আপনার নিবন্ধিত শ্রেণির কন্টেন্ট দেখানো হয়।"
              : "Only content for your registered class is shown."}
          </p>
          <Link
            href={otherLevelHref}
            className="text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            {locale === "bn"
              ? `বরং ${otherLevel} দেখুন`
              : `Switch to ${otherLevel}`}
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <StudentClassCourses locale={locale} level={level} />
      </Suspense>
    </section>
  );
}
