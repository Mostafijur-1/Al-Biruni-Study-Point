import { Suspense } from "react";
import Link from "next/link";
import { StudentClassCourses } from "@/components/content/StudentClassCourses";
import { PageHeader } from "@/components/shared/PageHeader";
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
      <PageHeader
        eyebrow="শিক্ষার্থী"
        title="আমার কোর্স ও ক্লাস"
        description={
          <p>
            শুধু তোমার নিবন্ধিত শ্রেণির কনটেন্ট দেখানো হয়।{" "}
            <Link
              href={otherLevelHref}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              বরং {otherLevel} দেখো
            </Link>
          </p>
        }
        actions={
          <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
            {level}
          </span>
        }
      />
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <StudentClassCourses level={level} />
      </Suspense>
    </section>
  );
}
