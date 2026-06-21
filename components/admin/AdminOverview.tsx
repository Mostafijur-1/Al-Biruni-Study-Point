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
  practiceQuestionsTotal: number;
  practiceQuestionsSSC: number;
  practiceQuestionsHSC: number;
  practiceAttemptsTotal: number;
  practiceAttemptsPassed: number;
  appInstallsTotal?: number;
  teacherChargesTotalTk: number;
  teacherCharges: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    isActive: boolean;
    approvalStatus: string;
    imageQuestionUploadCount: number;
    monthlyChargeTk: number;
    chargeCycleStartedAt?: string;
    chargeDueAt?: string;
    isChargeExpired?: boolean;
  }[];
};

function formatBillingDate(value: string | undefined, locale: Locale) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
  const { data, message, isLoading } = useApiQuery<{ stats: OverviewStats }>("/api/admin/overview", {
    loadingMessage: locale === "bn" ? "লোড হচ্ছে..." : "Loading...",
    errorMessage: locale === "bn" ? "ড্যাশবোর্ড লোড করা যায়নি।" : "Could not load dashboard.",
  });

  const stats = data?.stats;

  const quickLinks = [
    { href: path("/admin/students"), label:"Students" },
    { href: path("/admin/teachers"), label:"Teachers" },
    // { href: path("/admin/courses"), label: locale === "bn" ? "কোর্স" : "Courses" },
    { href: path("/admin/practice-mcqs"), label:"MCQ Management" },
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

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border bg-card/45 p-4 shadow-[var(--shadow-sm)] space-y-3">
                <div className="h-4 w-1/3 rounded bg-secondary animate-pulse" />
                <div className="h-8 w-2/3 rounded bg-secondary animate-pulse" />
                <div className="h-3.5 w-1/2 rounded bg-secondary animate-pulse" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-24 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        </div>
      ) : message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{message}</p>
      ) : stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label={locale === "bn" ? "শিক্ষার্থী" : "Students"}
              value={stats.studentsTotal}
              hint={`${stats.studentsActive} ${"active"}`}
            />
            <StatCard
              label={locale === "bn" ? "শিক্ষক" : "Teachers"}
              value={stats.teachersTotal}
              hint={`${stats.teachersPending} ${"pending"}`}
            />
            {/* <StatCard
              label={locale === "bn" ? "কোর্স" : "Courses"}
              value={stats.coursesTotal}
              hint={`${stats.coursesPublished} ${locale === "bn" ? "প্রকাশিত" : "published"}`}
            /> */}
            <StatCard
              label={"Practice questions"}
              value={stats.practiceQuestionsTotal}
              hint={`SSC: ${stats.practiceQuestionsSSC} · HSC: ${stats.practiceQuestionsHSC}`}
            />
            <StatCard
              label={"Practice attempts"}
              value={stats.practiceAttemptsTotal}
              hint={`${stats.practiceAttemptsPassed} ${"passed"}`}
            />
            <StatCard
              label={locale === "bn" ? "অ্যাপ ইনস্টল" : "App Installs"}
              value={stats.appInstallsTotal || 0}
              hint={locale === "bn" ? "ইউনিক ডিভাইস সংখ্যা" : "Unique devices"}
            />
          </div>

          <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">Teacher monthly charges</h2>
                <p className="text-xs text-muted">100 tk base + 3 tk per successful image question upload</p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                Total: {stats.teacherChargesTotalTk} tk
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-3">Teacher</th>
                    <th className="py-2 pr-3">Contact</th>
                    <th className="py-2 pr-3">Image uploads</th>
                    <th className="py-2 pr-3">Monthly charge</th>
                    <th className="py-2 pr-3">Cycle start</th>
                    <th className="py-2 pr-3">Cycle end</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.teacherCharges.map((teacher) => (
                    <tr key={teacher.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-3 font-semibold text-foreground">{teacher.name}</td>
                      <td className="py-3 pr-3 text-muted">{teacher.phone || teacher.email || "-"}</td>
                      <td className="py-3 pr-3 font-semibold">{teacher.imageQuestionUploadCount}</td>
                      <td className="py-3 pr-3 font-bold text-emerald-700">{teacher.monthlyChargeTk} tk</td>
                      <td className="py-3 pr-3 text-muted">
                        {formatBillingDate(teacher.chargeCycleStartedAt, locale)}
                      </td>
                      <td
                        className={cn(
                          "py-3 pr-3 font-semibold",
                          teacher.isChargeExpired ? "text-red-700" : "text-amber-700",
                        )}
                      >
                        {formatBillingDate(teacher.chargeDueAt, locale)}
                      </td>
                      <td className="py-3 pr-3 text-muted">
                        {teacher.approvalStatus}
                        {!teacher.isActive ? " - inactive" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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
