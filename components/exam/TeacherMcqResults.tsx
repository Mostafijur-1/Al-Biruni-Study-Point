"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getLocalizedPath, type Locale } from "@/lib/i18n";

type PopulatedStudent = {
  _id: string;
  name: string;
  phone?: string;
};

type PopulatedExam = {
  _id: string;
  title: string;
  totalMarks: number;
  passMark: number;
  duration: number;
};

type ResultRow = {
  _id: string;
  score: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number;
  attemptNo: number;
  submittedAt: string;
  student: PopulatedStudent;
  exam: PopulatedExam;
};

type ResultsResponse = {
  success: boolean;
  data?: { results: ResultRow[] };
  error?: { message: string };
};

type TeacherMcqResultsProps = {
  locale: Locale;
  examId: string;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function TeacherMcqResults({ locale, examId }: TeacherMcqResultsProps) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [message, setMessage] = useState("Loading results...");
  const examTitle = results[0]?.exam?.title;

  useEffect(() => {
    let active = true;

    async function loadResults() {
      const response = await fetch(`/api/mcq/results?examId=${examId}`, { cache: "no-store" });
      const payload = (await response.json()) as ResultsResponse;

      if (!active) {
        return;
      }

      if (!response.ok || !payload.success) {
        setMessage(payload.error?.message || "Could not load results.");
        return;
      }

      setResults(payload.data?.results || []);
      setMessage("");
    }

    loadResults().catch(() => setMessage("Could not load results."));

    return () => {
      active = false;
    };
  }, [examId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={getLocalizedPath("/teacher/mcq", locale)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Back to MCQ exams
        </Link>
        <Link
          href={getLocalizedPath(`/teacher/mcq/${examId}/edit`, locale)}
          className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-semibold text-primary"
        >
          Edit exam
        </Link>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Student results</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {examTitle || "MCQ Results"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {results.length > 0
            ? `${results.length} submission${results.length === 1 ? "" : "s"} (latest first)`
            : "Submissions appear here after students finish the exam."}
        </p>
      </div>

      {message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-muted">{message}</p>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-muted">No student submissions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">%</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Attempt</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">{row.student?.name || "Unknown"}</p>
                    {row.student?.phone && <p className="text-xs text-muted">{row.student.phone}</p>}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {row.score}
                    {row.exam?.totalMarks != null && (
                      <span className="text-muted"> / {row.exam.totalMarks}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{row.percentage.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.isPassed
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                          : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
                      }
                    >
                      {row.isPassed ? "Passed" : "Failed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDuration(row.timeTaken)}</td>
                  <td className="px-4 py-3">{row.attemptNo}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(row.submittedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
