"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Atom,
  Award,
  Beaker,
  BookOpen,
  Calculator,
  Calendar,
  Clock,
  Cpu,
  GraduationCap,
  Sparkles,
} from "lucide-react";

import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { createLocalizedPath } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/hooks/use-session";

type SubjectStatus = {
  subject: string;
  chapters: string[];
  lastResult: {
    score: number;
    totalQuestions: number;
    percentage: number;
    isPassed: boolean;
    timeTaken: number;
    submittedAt: string;
  } | null;
};

// Map subjects to icons and premium Tailwind gradient backgrounds
const subjectThemeMap: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    cardBg: string;
    iconBg: string;
    badgeBg: string;
    badgeText: string;
    paperLabel?: string;
  }
> = {
  Physics: {
    icon: Atom,
    accentColor: "text-brand-blue",
    cardBg: "from-blue-50/50 to-indigo-50/20 hover:border-blue-300/60",
    iconBg: "bg-blue-100 text-blue-700",
    badgeBg: "bg-blue-50 text-blue-800 border-blue-100",
    badgeText: "text-blue-700",
  },
  "Physics 1st Paper": {
    icon: Atom,
    accentColor: "text-blue-600",
    cardBg: "from-blue-50/60 to-sky-50/30 hover:border-blue-400/60",
    iconBg: "bg-blue-100 text-blue-700",
    badgeBg: "bg-blue-50 text-blue-800 border-blue-100",
    badgeText: "text-blue-700",
    paperLabel: "1st Paper",
  },
  "Physics 2nd Paper": {
    icon: Atom,
    accentColor: "text-indigo-600",
    cardBg: "from-indigo-50/60 to-violet-50/30 hover:border-indigo-400/60",
    iconBg: "bg-indigo-100 text-indigo-700",
    badgeBg: "bg-indigo-50 text-indigo-800 border-indigo-100",
    badgeText: "text-indigo-700",
    paperLabel: "2nd Paper",
  },
  Chemistry: {
    icon: Beaker,
    accentColor: "text-emerald-600",
    cardBg: "from-emerald-50/40 to-teal-50/20 hover:border-emerald-300/60",
    iconBg: "bg-emerald-100 text-emerald-700",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-100",
    badgeText: "text-emerald-700",
  },
  "Chemistry 1st Paper": {
    icon: Beaker,
    accentColor: "text-emerald-600",
    cardBg: "from-emerald-50/60 to-green-50/30 hover:border-emerald-400/60",
    iconBg: "bg-emerald-100 text-emerald-700",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-100",
    badgeText: "text-emerald-700",
    paperLabel: "1st Paper",
  },
  "Chemistry 2nd Paper": {
    icon: Beaker,
    accentColor: "text-teal-600",
    cardBg: "from-teal-50/60 to-cyan-50/30 hover:border-teal-400/60",
    iconBg: "bg-teal-100 text-teal-700",
    badgeBg: "bg-teal-50 text-teal-800 border-teal-100",
    badgeText: "text-teal-700",
    paperLabel: "2nd Paper",
  },
  Math: {
    icon: Calculator,
    accentColor: "text-amber-600",
    cardBg: "from-amber-50/40 to-orange-50/20 hover:border-amber-300/60",
    iconBg: "bg-amber-100 text-amber-700",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-100",
    badgeText: "text-amber-700",
  },
  "Higher Math": {
    icon: GraduationCap,
    accentColor: "text-purple-600",
    cardBg: "from-purple-50/40 to-fuchsia-50/20 hover:border-purple-300/60",
    iconBg: "bg-purple-100 text-purple-700",
    badgeBg: "bg-purple-50 text-purple-800 border-purple-100",
    badgeText: "text-purple-700",
  },
  "Higher Math 1st Paper": {
    icon: GraduationCap,
    accentColor: "text-purple-600",
    cardBg: "from-purple-50/60 to-violet-50/30 hover:border-purple-400/60",
    iconBg: "bg-purple-100 text-purple-700",
    badgeBg: "bg-purple-50 text-purple-800 border-purple-100",
    badgeText: "text-purple-700",
    paperLabel: "1st Paper",
  },
  "Higher Math 2nd Paper": {
    icon: GraduationCap,
    accentColor: "text-fuchsia-600",
    cardBg: "from-fuchsia-50/60 to-pink-50/30 hover:border-fuchsia-400/60",
    iconBg: "bg-fuchsia-100 text-fuchsia-700",
    badgeBg: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100",
    badgeText: "text-fuchsia-700",
    paperLabel: "2nd Paper",
  },
  ICT: {
    icon: Cpu,
    accentColor: "text-rose-600",
    cardBg: "from-rose-50/40 to-pink-50/20 hover:border-rose-300/60",
    iconBg: "bg-rose-100 text-rose-700",
    badgeBg: "bg-rose-50 text-rose-800 border-rose-100",
    badgeText: "text-rose-700",
  },
};

function StudentPracticeDashboard() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const path = createLocalizedPath(locale as any);
  const searchParams = useSearchParams();
  const { user, checking } = useSession({ listenToAuthChanges: true });
  const isGuest = !user;
  const level = searchParams.get("level") === "HSC" ? "HSC" : "SSC";

  const [statusList, setStatusList] = useState<SubjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (checking) return;

    async function loadStatus() {
      try {
        const url = isGuest
          ? `/api/mcq/practice/status?scope=guest&level=${level}`
          : "/api/mcq/practice/status";
        const { ok, payload } = await apiFetch<{ status: SubjectStatus[] }>(url);
        if (ok && isApiSuccess(payload)) {
          setStatusList(payload.data.status);
        } else {
          setError(getApiErrorMessage(payload, "Could not load practice data."));
        }
      } catch (err) {
        setError("An error occurred while connecting to the server.");
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, [checking, isGuest, level]);

  return (
    <section className="space-y-6">
      {/* Dashboard Header */}
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">
          {locale === "bn" ? "শিক্ষার্থী প্যানেল" : "Student panel"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-primary sm:text-4xl">
          {locale === "bn" ? "অধ্যায়-ভিত্তিক এমসিকিউ পরীক্ষা" : "Subject-wise MCQ Test"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "আপনার ক্লাসের যেকোনো বিষয় সিলেক্ট করে অধ্যায় অনুযায়ী র্যান্ডমলি জেনারেটেড এমসিকিউ পরীক্ষা দিয়ে প্রস্তুতি যাচাই করুন।"
            : "Select a subject to take a randomized MCQ test from your selected chapters."}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted">
            {locale === "bn" ? "বিষয়গুলো লোড হচ্ছে..." : "Loading subjects..."}
          </p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
      ) : statusList.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted">
          {locale === "bn"
            ? "আপনার ক্লাসের জন্য কোনো পরীক্ষা সামগ্রী প্রস্তুত নেই।"
            : "No test content is prepared for your class yet."}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {statusList.map((item) => {
            const theme = subjectThemeMap[item.subject] || {
              icon: BookOpen,
              accentColor: "text-primary",
              cardBg: "from-secondary/30 to-background hover:border-primary/20",
              iconBg: "bg-secondary text-primary",
              badgeBg: "bg-secondary text-primary border-border",
              badgeText: "text-primary",
            };
            const Icon = theme.icon;
            const hasAttempt = item.lastResult !== null;

            return (
              <div
                key={item.subject}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-gradient-to-br p-5 shadow-[var(--shadow-sm)] transition-all duration-300 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5",
                  theme.cardBg
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={cn("rounded-xl p-3 shadow-sm", theme.iconBg)}>
                      <Icon className="size-6 shrink-0" />
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        theme.badgeBg
                      )}
                    >
                      {item.chapters.length}{" "}
                      {locale === "bn"
                        ? `টি অধ্যায়`
                        : `${item.chapters.length === 1 ? "chapter" : "chapters"}`}
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-xl font-bold text-primary">
                    {/* Show base subject name (strip paper suffix for cleaner display) */}
                    {item.subject.replace(/ (1st|2nd) Paper$/, "")}
                  </h2>
                  {theme.paperLabel && (
                    <span className={cn(
                      "mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-bold border",
                      theme.badgeBg
                    )}>
                      {theme.paperLabel}
                    </span>
                  )}

                  {/* Previous Result Summary */}
                  <div className="mt-4">
                    {hasAttempt && item.lastResult ? (
                      <div className="rounded-xl border border-border bg-surface/80 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Award className="size-3.5 text-brand-yellow" />
                            {locale === "bn" ? "সর্বশেষ স্কোর" : "Last score"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-bold text-[10px] uppercase",
                              item.lastResult.isPassed
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {item.lastResult.isPassed
                              ? locale === "bn"
                                ? "পাস"
                                : "Passed"
                              : locale === "bn"
                                ? "ফেইল"
                                : "Failed"}
                          </span>
                        </div>
                        <div className="font-display text-lg font-bold text-primary">
                          {item.lastResult.score} / {item.lastResult.totalQuestions}{" "}
                          <span className="text-sm font-sans font-medium text-muted">
                            ({item.lastResult.percentage}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-2xs text-muted font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {Math.floor(item.lastResult.timeTaken / 60)}m{" "}
                            {item.lastResult.timeTaken % 60}s
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(item.lastResult.submittedAt).toLocaleDateString(
                              locale === "bn" ? "bn-BD" : "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-border p-4 text-center justify-center text-xs font-medium text-muted bg-surface/30">
                        <Sparkles className="size-3.5 text-accent" />
                        {locale === "bn" ? "কোনো পরীক্ষা দেওয়া হয়নি" : "No test attempts yet"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <Link href={path(`/student/practice/${item.subject}${isGuest ? `?level=${level}` : ""}`)} className="block">
                    <button
                      type="button"
                      className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover shadow-sm"
                    >
                      {hasAttempt
                        ? locale === "bn"
                          ? "আবার পরীক্ষা দিন"
                          : "Take Test Again"
                        : locale === "bn"
                          ? "পরীক্ষা শুরু করুন"
                          : "Start Test"}
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function StudentPracticePageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted">Loading...</p>
      </div>
    }>
      <StudentPracticeDashboard />
    </Suspense>
  );
}
