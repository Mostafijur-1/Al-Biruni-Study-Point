"use client";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import type { McqResultStudent } from "@/types/mcq";

export function ResultHistory() {
  const { data, message } = useApiQuery<{ results: McqResultStudent[] }>("/api/mcq/results", {
    loadingMessage: "Loading results...",
    errorMessage: "Could not load results.",
  });

  const results = data?.results ?? [];

  if (message) {
    return <p className="rounded border border-border bg-surface p-4 text-muted">{message}</p>;
  }

  if (!results.length) {
    return <p className="rounded border border-border bg-surface p-4 text-muted">No results yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {results.map((result) => (
        <article key={result._id} className="rounded border border-border bg-surface p-4 shadow-sm">
          <h2 className="font-bold text-primary">{result.exam?.title || "MCQ Exam"}</h2>
          <p className="mt-2 text-sm text-muted">
            Score {result.score}/{result.exam?.totalMarks || "-"} · {result.percentage}% · Attempt{" "}
            {result.attemptNo} · {result.isPassed ? "Passed" : "Not passed"}
          </p>
        </article>
      ))}
    </div>
  );
}
