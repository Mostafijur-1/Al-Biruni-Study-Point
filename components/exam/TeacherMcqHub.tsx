"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getLocalizedPath, type Locale } from "@/lib/i18n";

type Exam = {
  _id: string;
  title: string;
  duration: number;
  totalMarks: number;
  passMark: number;
  questionCount: number;
  isPublished: boolean;
  createdAt: string;
};

type ExamsResponse = {
  success: boolean;
  data?: { exams: Exam[] };
  error?: { message: string };
};

export function TeacherMcqHub({ locale }: { locale: Locale }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [message, setMessage] = useState("Loading your exams...");

  useEffect(() => {
    let active = true;

    async function loadExams() {
      const response = await fetch("/api/mcq/exams?published=false", { cache: "no-store" });
      const payload = (await response.json()) as ExamsResponse;

      if (!active) {
        return;
      }

      if (!response.ok || !payload.success) {
        setMessage(payload.error?.message || "Could not load exams.");
        return;
      }

      setExams(payload.data?.exams || []);
      setMessage("");
    }

    loadExams().catch(() => setMessage("Could not load exams."));

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Teacher panel</p>
          <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">MCQ Exams</h1>
          <p className="mt-2 text-sm text-muted">Create exams, edit questions, and review student scores.</p>
        </div>
        <Link
          href={getLocalizedPath("/teacher/mcq/create", locale)}
          className="rounded-lg bg-brand-red px-4 py-3 text-center text-sm font-semibold text-white"
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
                  <p className="mt-2 text-sm text-muted">
                    {exam.questionCount} questions · {exam.duration} min · {exam.totalMarks} marks · pass{" "}
                    {exam.passMark}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={getLocalizedPath(`/teacher/mcq/${exam._id}/results`, locale)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary"
                  >
                    Results
                  </Link>
                  <Link
                    href={getLocalizedPath(`/teacher/mcq/${exam._id}/edit`, locale)}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
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
