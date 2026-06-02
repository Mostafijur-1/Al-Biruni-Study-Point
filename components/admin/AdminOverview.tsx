"use client";

import Link from "next/link";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AdminOverviewProps = {
  locale: Locale;
};

type OverviewStats = {
  studentsTotal: number;
  studentsActive: number;
  teachersTotal: number;
  teachersActive: number;
  teachersPending: number;
  coursesTotal: number;
  coursesPublished: number;
  examsTotal: number;
  examsPublished: number;
  resultsTotal: number;
};

function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]", className)}>
      <p className="text-xs font-bold uppercase tracking-widest text-accent">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function AdminOverview({ locale }: AdminOverviewProps) {
  const path = createLocalizedPath(locale);
  const { data, message } = useApiQuery<{ stats: OverviewStats }>("/api/admin/overview", {
    loadingMessage: locale === "bn" ? "লোড হচ্ছে..." : "Loading...",
    errorMessage: locale === "bn" ? "ড্যাশবোর্ড লোড করা যায়নি।" : "Could not load dashboard.",
  });

  const stats = data?.stats;

  const quickLinks = [
    { href: path("/admin/students"), label: locale === "bn" ? "শিক্ষার্থী" : "Students" },
    { href: path("/admin/teachers"), label: locale === "bn" ? "শিক্ষক" : "Teachers" },
    { href: path("/admin/courses"), label: locale === "bn" ? "কোর্স" : "Courses" },
    { href: path("/admin/exams"), label: locale === "bn" ? "পরীক্ষা ও ফলাফল" : "Exams & results" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {locale === "bn" ? "অ্যাডমিন ড্যাশবোর্ড" : "Admin dashboard"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "শিক্ষার্থী-শিক্ষক অ্যাকাউন্ট, কোর্স, পরীক্ষা ও ফলাফল পরিচালনা করুন।"
            : "Manage students, teachers, courses, exams, and results."}
        </p>
      </div>

      {message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{message}</p>
      ) : stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label={locale === "bn" ? "শিক্ষার্থী" : "Students"}
              value={stats.studentsTotal}
              hint={`${stats.studentsActive} ${locale === "bn" ? "সক্রিয়" : "active"}`}
            />
            <StatCard
              label={locale === "bn" ? "শিক্ষক" : "Teachers"}
              value={stats.teachersTotal}
              hint={`${stats.teachersPending} ${locale === "bn" ? "অপেক্ষমান" : "pending"}`}
            />
            <StatCard
              label={locale === "bn" ? "কোর্স" : "Courses"}
              value={stats.coursesTotal}
              hint={`${stats.coursesPublished} ${locale === "bn" ? "প্রকাশিত" : "published"}`}
            />
            <StatCard
              label={locale === "bn" ? "MCQ পরীক্ষা" : "MCQ exams"}
              value={stats.examsTotal}
              hint={`${stats.examsPublished} ${locale === "bn" ? "প্রকাশিত" : "published"}`}
            />
            <StatCard
              label={locale === "bn" ? "জমা ফলাফল" : "Exam attempts"}
              value={stats.resultsTotal}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
