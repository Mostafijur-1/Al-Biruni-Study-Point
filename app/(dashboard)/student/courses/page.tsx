import { Suspense } from "react";
import Link from "next/link";
import { StudentClassCourses } from "@/components/content/StudentClassCourses";
import { getLocalizedPath } from "@/lib/i18n";

type StudentCoursesPageProps = {
  searchParams: Promise<{ level?: string }>;
};

export default async function StudentCoursesPage({ searchParams }: StudentCoursesPageProps) {
  const { level: rawLevel } = await searchParams;
  const level = rawLevel === "HSC" ? "HSC" : "SSC";
  const otherLevel = level === "SSC" ? "HSC" : "SSC";
  const otherLevelHref = getLocalizedPath(`/student/courses?level=${otherLevel}`);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Student panel</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-primary">
            আমার কোর্স ও ক্লাস
          </h1>
          <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
            {level}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            শুধু আপনার নিবন্ধিত শ্রেণির কন্টেন্ট দেখানো হয়।
          </p>
          <Link
            href={otherLevelHref}
            className="text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            বরং {otherLevel} দেখুন
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <StudentClassCourses level={level} />
      </Suspense>
    </section>
  );
}

