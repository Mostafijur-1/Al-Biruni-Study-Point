"use client";

import { useEffect, useState } from "react";

type Result = {
  _id: string;
  score: number;
  percentage: number;
  isPassed: boolean;
  attemptNo: number;
  submittedAt: string;
  exam?: { title?: string; totalMarks?: number };
};

type ResultsResponse = {
  success: boolean;
  data?: { results: Result[] };
  error?: { message: string };
};

export function ResultHistory() {
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("Loading results...");

  useEffect(() => {
    async function loadResults() {
      const response = await fetch("/api/mcq/results", { cache: "no-store" });
      const payload = (await response.json()) as ResultsResponse;

      if (!response.ok || !payload.success) {
        setMessage(payload.error?.message || "Could not load results.");
        return;
      }

      setResults(payload.data?.results || []);
      setMessage("");
    }

    loadResults().catch(() => setMessage("Could not load results."));
  }, []);

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
            Score {result.score}/{result.exam?.totalMarks || "-"} · {result.percentage}% · Attempt {result.attemptNo} · {result.isPassed ? "Passed" : "Not passed"}
          </p>
        </article>
      ))}
    </div>
  );
}
