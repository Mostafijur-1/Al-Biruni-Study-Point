"use client";

import { useEffect, useMemo, useState } from "react";
import { getOptionLabel, McqOption } from "@/components/exam/McqOption";
import { cn } from "@/lib/utils";

type Question = {
  _id: string;
  question: string;
  questionBn?: string;
  options: string[];
  marks: number;
};

type Exam = {
  _id: string;
  title: string;
  duration: number;
  totalMarks: number;
  passMark: number;
};

type ExamResponse = {
  success: boolean;
  data?: { exam: Exam; questions: Question[] };
  error?: { message: string };
};

type SubmitResponse = {
  success: boolean;
  data?: {
    result: {
      score: number;
      percentage: number;
      isPassed: boolean;
      attemptNo: number;
    };
    totalMarks: number;
    solutions: { questionId: string; correctIndex: number; explanation?: string }[];
  };
  error?: { message: string };
};

function getOptionResultMode(
  optionIndex: number,
  selectedIndex: number | undefined,
  correctIndex: number | undefined,
  hasResult: boolean,
): "idle" | "correct" | "wrong" | "missed-correct" {
  if (!hasResult || correctIndex === undefined) {
    return "idle";
  }

  if (optionIndex === correctIndex) {
    return selectedIndex === correctIndex ? "correct" : "missed-correct";
  }

  if (selectedIndex === optionIndex) {
    return "wrong";
  }

  return "idle";
}

export function McqExamRunner({ examId }: { examId: string }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [message, setMessage] = useState("Loading exam...");
  const [result, setResult] = useState<SubmitResponse["data"] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  useEffect(() => {
    let isMounted = true;

    async function loadExam() {
      const response = await fetch(`/api/mcq/exams/${examId}`, { cache: "no-store" });
      const payload = (await response.json()) as ExamResponse;

      if (!isMounted) {
        return;
      }

      if (!response.ok || !payload.success || !payload.data) {
        setMessage(payload.error?.message || "Could not load exam.");
        return;
      }

      setExam(payload.data.exam);
      setQuestions(payload.data.questions);
      setSecondsLeft(payload.data.exam.duration * 60);
      setMessage("");
    }

    loadExam().catch(() => setMessage("Could not load exam."));

    return () => {
      isMounted = false;
    };
  }, [examId]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || result) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current === null ? current : Math.max(0, current - 1)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [secondsLeft, result]);

  async function submitAttempt() {
    if (!exam || isSubmitting || result) {
      return;
    }

    setIsSubmitting(true);
    const elapsedSeconds = exam.duration * 60 - (secondsLeft || 0);
    const response = await fetch("/api/mcq/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId: exam._id,
        timeTaken: elapsedSeconds,
        answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
          questionId,
          selectedIndex,
        })),
      }),
    });
    const payload = (await response.json()) as SubmitResponse;

    if (!response.ok || !payload.success || !payload.data) {
      setMessage(payload.error?.message || "Could not submit exam.");
      setIsSubmitting(false);
      return;
    }

    setResult(payload.data);
    setIsSubmitting(false);
  }

  useEffect(() => {
    if (secondsLeft === 0 && !result) {
      const timeout = window.setTimeout(() => {
        submitAttempt();
      }, 0);

      return () => window.clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  if (message && !exam) {
    return <p className="rounded-xl border border-border bg-surface p-4 text-muted">{message}</p>;
  }

  if (!exam) {
    return null;
  }

  const minutes = Math.floor((secondsLeft || 0) / 60);
  const seconds = String((secondsLeft || 0) % 60).padStart(2, "0");
  const isLowTime = (secondsLeft ?? 0) <= 60 && !result;

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">MCQ Exam</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-primary sm:text-3xl">{exam.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {answeredCount}/{questions.length} answered · pass mark {exam.passMark}
            </p>
          </div>
          <div
            className={cn(
              "shrink-0 rounded-xl border-2 px-4 py-3 text-center",
              isLowTime ? "border-brand-red bg-red-50" : "border-primary/20 bg-secondary",
            )}
          >
            <p className="text-xs font-semibold uppercase text-muted">Time left</p>
            <p
              className={cn(
                "font-display text-2xl font-bold tabular-nums",
                isLowTime ? "text-brand-red" : "text-primary",
              )}
            >
              {minutes}:{seconds}
            </p>
          </div>
        </div>

        {!result && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {questions.map((question, index) => {
        const solution = result?.solutions.find((item) => item.questionId === question._id);
        const selectedIndex = answers[question._id];
        const isAnswered = selectedIndex !== undefined;

        return (
          <article
            key={question._id}
            className={cn(
              "rounded-xl border-2 bg-card p-4 shadow-[var(--shadow-sm)] transition-colors sm:p-5",
              result
                ? "border-border"
                : isAnswered
                  ? "border-primary/25"
                  : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <h2 className="pt-0.5 text-base font-bold leading-snug text-foreground sm:text-lg">
                  {question.questionBn || question.question}
                </h2>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
                {question.marks} mark
              </span>
            </div>

            <div className="mt-4 grid gap-2.5 sm:gap-3">
              {question.options.map((option, optionIndex) => (
                <McqOption
                  key={`${question._id}-${optionIndex}`}
                  label={getOptionLabel(optionIndex)}
                  optionText={option}
                  isSelected={selectedIndex === optionIndex}
                  disabled={Boolean(result)}
                  resultMode={getOptionResultMode(
                    optionIndex,
                    selectedIndex,
                    solution?.correctIndex,
                    Boolean(result),
                  )}
                  onSelect={() =>
                    setAnswers((current) => ({
                      ...current,
                      [question._id]: optionIndex,
                    }))
                  }
                />
              ))}
            </div>

            {solution?.explanation && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 sm:p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Solution</p>
                <p className="mt-1 text-sm leading-6 text-emerald-900">{solution.explanation}</p>
              </div>
            )}
          </article>
        );
      })}

      {message && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>
      )}

      {result ? (
        <div
          className={cn(
            "rounded-xl border-2 p-5 shadow-[var(--shadow-md)] sm:p-6",
            result.result.isPassed
              ? "border-emerald-400 bg-emerald-50"
              : "border-brand-yellow bg-secondary",
          )}
        >
          <h2 className="font-display text-2xl font-bold text-primary">
            Score: {result.result.score}/{result.totalMarks}
          </h2>
          <p className="mt-2 text-muted">
            {result.result.percentage}% · Attempt {result.result.attemptNo} ·{" "}
            <span className={result.result.isPassed ? "font-semibold text-emerald-700" : "font-semibold text-brand-red"}>
              {result.result.isPassed ? "Passed" : "Needs improvement"}
            </span>
          </p>
          <p className="mt-3 text-xs text-muted">
            Green = correct answer · Red = your wrong choice
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={submitAttempt}
          disabled={isSubmitting || answeredCount === 0}
          className="w-full rounded-xl bg-brand-red px-4 py-3.5 font-semibold text-white shadow-sm transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : `Submit exam (${answeredCount}/${questions.length})`}
        </button>
      )}
    </section>
  );
}
