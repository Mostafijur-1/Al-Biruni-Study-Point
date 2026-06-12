"use client";

import { useCallback, useState } from "react";

import { formatClassList, getClassLabel, STUDENT_CLASSES } from "@/lib/content/classes";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { formatMcqExamMeta } from "@/lib/mcq/format";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StudentClass } from "@/types";
import type { McqResultTeacherRow } from "@/types/mcq";

type AdminExamRow = {
  _id: string;
  title: string;
  duration: number;
  totalMarks: number;
  passMark: number;
  questionCount: number;
  isPublished: boolean;
  targetClasses: StudentClass[];
  attemptCount: number;
  teacher: { id: string; name?: string; email?: string; phone?: string } | null;
  course: { id: string; title?: string; slug?: string } | null;
};

export function AdminExamsPanel({ locale }: { locale: Locale }) {
  const [selectedClass, setSelectedClass] = useState<StudentClass | "all">("all");
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [results, setResults] = useState<McqResultTeacherRow[]>([]);
  const [resultsMessage, setResultsMessage] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const query =
    selectedClass === "all" ? "/api/admin/exams" : `/api/admin/exams?class=${selectedClass}`;

  const { data, message, isLoading } = useApiQuery<{ exams: AdminExamRow[] }>(query, {
    loadingMessage: locale === "bn" ? "লোড হচ্ছে..." : "Loading...",
    errorMessage: locale === "bn" ? "পরীক্ষা লোড করা যায়নি।" : "Could not load exams.",
  });

  const exams = data?.exams ?? [];

  const loadResults = useCallback(async (examId: string) => {
    setSelectedExamId(examId);
    setLoadingResults(true);
    setResultsMessage(locale === "bn" ? "ফলাফল লোড হচ্ছে..." : "Loading results...");

    const { ok, payload } = await apiFetch<{ results: McqResultTeacherRow[] }>(
      `/api/mcq/results?examId=${examId}`,
    );

    setLoadingResults(false);

    if (!ok || !isApiSuccess(payload)) {
      setResults([]);
      setResultsMessage(getApiErrorMessage(payload, "Could not load results."));
      return;
    }

    setResults(payload.data.results);
    setResultsMessage(
      payload.data.results.length === 0
        ? locale === "bn"
          ? "এই পরীক্ষায় এখনও কোনো জমা নেই।"
          : "No submissions for this exam yet."
        : null,
    );
  }, [locale]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {locale === "bn" ? "পরীক্ষা ও ফলাফল" : "Exams & results"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "শ্রেণি অনুযায়ী পরীক্ষা দেখুন এবং শিক্ষার্থীর ফলাফল পর্যালোচনা করুন।"
            : "Browse exams by class and review student results."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedClass("all")}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-semibold transition",
            selectedClass === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-muted",
          )}
        >
          {locale === "bn" ? "সব" : "All"}
        </button>
        {STUDENT_CLASSES.map((studentClass) => (
          <button
            key={studentClass}
            type="button"
            onClick={() => setSelectedClass(studentClass)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-semibold transition",
              selectedClass === studentClass
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted",
            )}
          >
            {getClassLabel(studentClass, locale)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2 animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card/45 p-4 space-y-3 shadow-[var(--shadow-sm)]">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-32 rounded bg-secondary animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-secondary animate-pulse" />
                </div>
                <div className="h-4 w-2/3 rounded bg-secondary animate-pulse" />
                <div className="h-3.5 w-1/2 rounded bg-secondary animate-pulse" />
                <div className="h-4 w-12 rounded bg-secondary animate-pulse mt-1" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="h-6 w-20 rounded bg-secondary animate-pulse" />
            <div className="space-y-3 mt-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border/40 bg-surface/30 p-3 space-y-2">
                  <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
                  <div className="h-3.5 w-1/3 rounded bg-secondary animate-pulse" />
                  <div className="h-3.5 w-1/4 rounded bg-secondary animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{message}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ul className="space-y-3">
            {exams.length === 0 ? (
              <li className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
                {locale === "bn" ? "কোনো পরীক্ষা নেই।" : "No exams found."}
              </li>
            ) : (
              exams.map((exam) => (
                <li key={exam._id}>
                  <button
                    type="button"
                    onClick={() => loadResults(exam._id)}
                    className={cn(
                      "w-full rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-sm)] transition hover:border-primary/40",
                      selectedExamId === exam._id ? "border-primary" : "border-border",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-primary">{exam.title}</h2>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          exam.isPublished
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-secondary text-muted",
                        )}
                      >
                        {exam.isPublished
                          ? locale === "bn"
                            ? "প্রকাশিত"
                            : "Published"
                          : locale === "bn"
                            ? "খসড়া"
                            : "Draft"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{formatMcqExamMeta(exam, "min")}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatClassList(exam.targetClasses, locale)}
                    </p>
                    {exam.teacher && (
                      <p className="mt-1 text-xs text-muted">
                        {locale === "bn" ? "শিক্ষক" : "Teacher"}: {exam.teacher.name}
                      </p>
                    )}
                    {exam.course?.title && (
                      <p className="mt-1 text-xs text-muted">
                        {locale === "bn" ? "কোর্স" : "Course"}: {exam.course.title}
                      </p>
                    )}
                    <p className="mt-2 text-xs font-semibold text-accent">
                      {exam.attemptCount} {locale === "bn" ? "জমা" : "attempts"}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>

          <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-lg font-bold text-primary">
              {locale === "bn" ? "ফলাফল" : "Results"}
            </h2>
            {!selectedExamId ? (
              <p className="mt-3 text-sm text-muted">
                {locale === "bn"
                  ? "ফলাফল দেখতে একটি পরীক্ষা নির্বাচন করুন।"
                  : "Select an exam to view results."}
              </p>
            ) : loadingResults ? (
              <p className="mt-3 text-sm text-muted">{resultsMessage}</p>
            ) : resultsMessage && results.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{resultsMessage}</p>
            ) : (
              <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
                {results.map((row) => (
                  <li key={row._id} className="rounded-lg border border-border bg-surface p-3">
                    <p className="font-semibold text-primary">{row.student?.name ?? "Student"}</p>
                    <p className="mt-1 text-sm text-muted">
                      {row.score}/{row.exam?.totalMarks ?? "—"} · {row.percentage.toFixed(1)}%
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {row.isPassed
                        ? locale === "bn"
                          ? "পাস"
                          : "Passed"
                        : locale === "bn"
                          ? "ফেল"
                          : "Failed"}{" "}
                      · {locale === "bn" ? "চেষ্টা" : "Attempt"} {row.attemptNo}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
