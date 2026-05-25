"use client";

import Link from "next/link";

import { buttonVariants, pressableClasses } from "@/components/ui/button";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { cn } from "@/lib/utils";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import { formatMcqExamMeta } from "@/lib/mcq/format";
import type { McqExamSummaryTeacher } from "@/types/mcq";

export function TeacherMcqHub({ locale }: { locale: Locale }) {
  const path = createLocalizedPath(locale);
  const { data, message } = useApiQuery<{ exams: McqExamSummaryTeacher[] }>(
    "/api/mcq/exams?published=false",
    {
      loadingMessage: "Loading your exams...",
      errorMessage: "Could not load exams.",
    },
  );

  const exams = data?.exams ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Teacher panel</p>
          <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">MCQ Exams</h1>
          <p className="mt-2 text-sm text-muted">Create exams, edit questions, and review student scores.</p>
        </div>
        <Link
          href={path("/teacher/mcq/create")}
          className={cn(buttonVariants(), "justify-center shadow-sm")}
        >
          Create new exam
        </Link>
      </div>

      {message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-muted">{message}</p>
      ) : exams.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-muted">
          You have not created any MCQ exams yet.
        </p>
      ) : (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <article
              key={exam._id}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-primary">{exam.title}</h2>
                    <span
                      className={
                        exam.isPublished
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                          : "rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted"
                      }
                    >
                      {exam.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{formatMcqExamMeta(exam, "min")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={path(`/teacher/mcq/${exam._id}/results`)}
                    className={cn(
                      pressableClasses,
                      "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary",
                    )}
                  >
                    Results
                  </Link>
                  <Link
                    href={path(`/teacher/mcq/${exam._id}/edit`)}
                    className={cn(
                      pressableClasses,
                      "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover",
                    )}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
