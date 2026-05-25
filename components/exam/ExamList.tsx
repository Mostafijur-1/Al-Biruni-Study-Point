"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Locale } from "@/lib/i18n";

type Exam = {
  _id: string;
  title: string;
  duration: number;
  totalMarks: number;
  passMark: number;
  questionCount: number;
};

type ExamsResponse = {
  success: boolean;
  data?: { exams: Exam[] };
  error?: { message: string };
};

export function ExamList({ locale }: { locale: Locale }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [message, setMessage] = useState("Loading exams...");

  useEffect(() => {
    let isMounted = true;

    async function loadExams() {
      const response = await fetch("/api/mcq/exams", { cache: "no-store" });
      const payload = (await response.json()) as ExamsResponse;

      if (!isMounted) {
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
      isMounted = false;
    };
  }, []);

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
              <p className="mt-2 text-sm text-muted">
                {exam.questionCount} questions · {exam.duration} minutes · {exam.totalMarks} marks · pass {exam.passMark}
              </p>
            </div>
            <Link
              href={`/${locale}/student/exams/${exam._id}`}
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
