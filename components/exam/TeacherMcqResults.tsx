"use client";

import Link from "next/link";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import { formatDurationSeconds } from "@/lib/format/time";
import type { McqResultTeacherRow } from "@/types/mcq";

type TeacherMcqResultsProps = {
  locale: Locale;
  examId: string;
};

export function TeacherMcqResults({ locale, examId }: TeacherMcqResultsProps) {
  const path = createLocalizedPath(locale);
  const { data, message } = useApiQuery<{ results: McqResultTeacherRow[] }>(
    `/api/mcq/results?examId=${examId}`,
    {
      loadingMessage: "Loading results...",
      errorMessage: "Could not load results.",
    },
  );

  const results = data?.results ?? [];
  const examTitle = results[0]?.exam?.title;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={path("/teacher/mcq")}
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Back to MCQ exams
        </Link>
        <Link
          href={path(`/teacher/mcq/${examId}/edit`)}
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
                  <td className="px-4 py-3">{formatDurationSeconds(row.timeTaken)}</td>
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
