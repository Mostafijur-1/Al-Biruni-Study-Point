"use client";

import Link from "next/link";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import { formatMcqExamMeta } from "@/lib/mcq/format";
import type { McqExamSummary } from "@/types/mcq";

export function ExamList({ locale }: { locale: Locale }) {
  const path = createLocalizedPath(locale);
  const { data, message } = useApiQuery<{ exams: McqExamSummary[] }>("/api/mcq/exams", {
    loadingMessage: "Loading exams...",
    errorMessage: "Could not load exams.",
  });

  const exams = data?.exams ?? [];

  if (message) {
    return <p className="rounded border border-border bg-surface p-4 text-muted">{message}</p>;
  }

  if (!exams.length) {
    return (
      <p className="rounded border border-border bg-surface p-4 text-muted">
        No published MCQ exams are available yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {exams.map((exam) => (
        <article key={exam._id} className="rounded border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-primary">{exam.title}</h2>
              <p className="mt-2 text-sm text-muted">{formatMcqExamMeta(exam, "minutes")}</p>
            </div>
            <Link
              href={path(`/student/exams/${exam._id}`)}
              className="rounded bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
            >
              Start
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
