"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  CircleDashed,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { DailyLearningPlanCard } from "@/components/learning/DailyLearningPlanCard";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";
import type { MasteryData } from "@/types/learning";

const statusTheme = {
  strong: {
    label: "শক্তিশালী",
    icon: CheckCircle2,
    badge: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-500",
  },
  improving: {
    label: "উন্নতি হচ্ছে",
    icon: TrendingUp,
    badge: "bg-sky-100 text-sky-800",
    bar: "bg-sky-500",
  },
  weak: {
    label: "আরও অনুশীলন দরকার",
    icon: Target,
    badge: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  not_started: {
    label: "শুরু হয়নি",
    icon: CircleDashed,
    badge: "bg-slate-100 text-slate-700",
    bar: "bg-slate-300",
  },
} as const;

export function LearningInsightsDashboard() {
  const [mastery, setMastery] = useState<MasteryData | null>(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const viewTracked = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { ok, payload } = await apiFetch<MasteryData>("/api/learning/mastery");
      if (active && ok && isApiSuccess(payload)) {
        setMastery(payload.data);
        setSelectedSubject(payload.data.subjects[0]?.subject ?? "");
      } else if (active) {
        setError(getApiErrorMessage(payload, "দক্ষতার মানচিত্র লোড করা যায়নি।"));
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && mastery && !viewTracked.current) {
      viewTracked.current = true;
      trackStudentEvent("student_learning_plan_viewed", "learning_insights", {
        tracked_chapters: mastery.chapters.length,
      });
    }
  }, [loading, mastery]);

  const visibleChapters = useMemo(
    () =>
      mastery?.chapters.filter((chapter) => chapter.subject === selectedSubject) ?? [],
    [mastery, selectedSubject],
  );
  const selectedSummary = mastery?.subjects.find(
    (subject) => subject.subject === selectedSubject,
  );
  const practicedChapters =
    mastery?.chapters.filter((chapter) => chapter.attempts > 0).length ?? 0;
  const strongChapters =
    mastery?.chapters.filter((chapter) => chapter.status === "strong").length ?? 0;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-52 animate-pulse rounded-3xl bg-primary/10" />
        <div className="h-64 animate-pulse rounded-2xl bg-secondary/60" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900 via-primary to-sky-800 p-5 text-white shadow-[var(--shadow-lg)] sm:p-7">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-yellow">
          <Sparkles className="size-4" />
          তোমার জন্য সাজানো
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-4xl">শেখার প্ল্যাও ও দক্ষতার মানচিত্র</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
          তোমার অনুশীলনের ফল থেকে কোন অধ্যায় শক্তিশালী, কোথায় আরও কাজ দরকার
          এবং আজ কী করবে—সব এক জায়গায়।
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DailyLearningPlanCard />

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <Brain className="size-5 text-violet-700" />
          <p className="mt-2 text-2xl font-black text-primary">{practicedChapters}</p>
          <p className="text-xs font-bold text-muted">অনুশীলন করা অধ্যায়</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <BookOpenCheck className="size-5 text-emerald-700" />
          <p className="mt-2 text-2xl font-black text-primary">{strongChapters}</p>
          <p className="text-xs font-bold text-muted">শক্তিশালী অধ্যায়</p>
        </article>
        <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <Target className="size-5 text-sky-700" />
          <p className="mt-2 text-2xl font-black text-primary">
            {mastery?.recommendation?.score ?? 0}%
          </p>
          <p className="truncate text-xs font-bold text-muted">
            পরবর্তী লক্ষ্য: {mastery?.recommendation?.chapter ?? "প্র্যাকটিস শুরু করো"}
          </p>
        </article>
      </div>

      {mastery && mastery.subjects.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-3">
            <p className="px-2 py-2 text-xs font-black uppercase tracking-widest text-muted">
              বিষয়
            </p>
            <div className="space-y-1">
              {mastery.subjects.map((subject) => (
                <button
                  key={subject.subject}
                  type="button"
                  onClick={() => setSelectedSubject(subject.subject)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition",
                    selectedSubject === subject.subject
                      ? "bg-primary text-white"
                      : "text-primary hover:bg-secondary",
                  )}
                >
                  <span className="truncate">{subject.subject}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-2xs",
                      selectedSubject === subject.subject
                        ? "bg-white/15"
                        : "bg-secondary",
                    )}
                  >
                    {subject.score}%
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black text-brand-blue">{selectedSubject}</p>
                <h2 className="mt-1 text-xl font-black text-primary">অধ্যায়ভিত্তিক দক্ষতা</h2>
              </div>
              {selectedSummary && (
                <p className="text-xs font-bold text-muted">
                  {selectedSummary.completedChapters}/{selectedSummary.totalChapters} অধ্যায় শুরু
                </p>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {visibleChapters.map((chapter) => {
                const theme = statusTheme[chapter.status];
                const Icon = theme.icon;
                return (
                  <article
                    key={`${chapter.subject}-${chapter.chapter}`}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black leading-5 text-primary">
                          {chapter.chapter}
                        </h3>
                        <p className="mt-1 text-2xs font-semibold text-muted">
                          {chapter.attempts > 0
                            ? `${chapter.attempts}টি উত্তর · ${chapter.accuracy}% সঠিক`
                            : `${chapter.availableQuestions}টি প্রশ্ন প্রস্তুত`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-black",
                          theme.badge,
                        )}
                      >
                        <Icon className="size-3.5" />
                        {theme.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full", theme.bar)}
                          style={{ width: `${chapter.score}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs font-black text-primary">
                        {chapter.score}%
                      </span>
                    </div>
                    {chapter.status !== "strong" && chapter.availableQuestions > 0 && (
                      <Link
                        href="/student/practice"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-red hover:underline"
                      >
                        এই অধ্যায় অনুশীলন করো
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Brain className="mx-auto size-10 text-brand-blue" />
          <h2 className="mt-3 text-lg font-black text-primary">দক্ষতার মানচিত্র তৈরি হচ্ছে</h2>
          <p className="mt-1 text-sm text-muted">
            প্রথম MCQ অনুশীলন শেষ করলে এখানে অধ্যায়ভিত্তিক অগ্রগতি দেখা যাবে।
          </p>
          <Link
            href="/student/practice"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
          >
            প্র্যাকটিস শুরু করো
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
