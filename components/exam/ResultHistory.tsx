"use client";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import type { McqResultStudent } from "@/types/mcq";

export function ResultHistory() {
  const { data, message, isLoading } = useApiQuery<{ results: McqResultStudent[] }>("/api/mcq/results", {
    loadingMessage: "Loading results...",
    errorMessage: "Could not load results.",
  });

  const results = data?.results ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-card/45 p-4 space-y-3 shadow-sm">
            <div className="h-6 w-1/3 rounded bg-secondary animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-secondary animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (message) {
    return <p className="rounded border border-border bg-surface p-4 text-muted">{message}</p>;
  }

  if (!results.length) {
    return <p className="rounded border border-border bg-surface p-4 text-muted">No results yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {results.map((result: any) => (
        <article key={result._id} className="rounded border border-border bg-surface p-4 shadow-sm">
          <h2 className="flex items-center font-bold text-primary">
            {result.exam?.title || "MCQ Exam"}
            {result.isPractice && (
              <span className="ml-2 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">
                MCQ Test
              </span>
            )}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Score {result.score}/{result.exam?.totalMarks || "-"} · {result.percentage}% ·{" "}
            {result.isPractice ? "Latest Attempt" : `Attempt ${result.attemptNo}`} ·{" "}
            <span className={result.isPassed ? "font-semibold text-success" : "font-semibold text-destructive"}>
              {result.isPassed ? "Passed" : "Not passed"}
            </span>
          </p>
          {result.teacherComment && (
            <div className="mt-3 rounded-lg border border-brand-yellow/30 bg-brand-yellow/5 p-3 text-xs sm:text-sm">
              <span className="font-bold text-brand-red">মন্তব্য ({result.commentedBy?.name || "শিক্ষক"}):</span>
              <p className="mt-1 text-primary font-medium italic leading-relaxed">{result.teacherComment}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
