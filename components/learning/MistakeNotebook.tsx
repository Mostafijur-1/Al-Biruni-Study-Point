"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock3,
  Filter,
  NotebookPen,
  RefreshCw,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";

import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

type Mistake = {
  id: string;
  subject: string;
  chapter: string;
  question: string;
  options: string[];
  imageUrl?: string;
  wrongCount: number;
  reviewCount: number;
  correctStreak: number;
  status: "active" | "mastered";
  nextReviewAt: string;
  lastWrongAt: string;
};

type MistakeResponse = {
  mistakes: Mistake[];
  summary: { active: number; due: number; mastered: number };
  subjects: string[];
};

type AnswerResult = {
  isCorrect: boolean;
  correctIndex: number;
  explanation?: string;
  status: "active" | "mastered";
  correctStreak: number;
  nextReviewAt: string;
};

async function requestMistakes(
  status: "active" | "mastered",
  subject: string,
  dueOnly: boolean,
) {
  const query = new URLSearchParams({ status });
  if (subject) query.set("subject", subject);
  if (dueOnly) query.set("due", "1");
  return apiFetch<MistakeResponse>(`/api/learning/mistakes?${query}`);
}

export function MistakeNotebook() {
  const searchParams = useSearchParams();
  const initialDueOnly = searchParams.get("due") === "1";
  const [status, setStatus] = useState<"active" | "mastered">("active");
  const [subject, setSubject] = useState("");
  const [dueOnly, setDueOnly] = useState(initialDueOnly);
  const [data, setData] = useState<MistakeResponse | null>(null);
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const viewTracked = useRef(false);

  const loadMistakes = useCallback(async () => {
    setLoading(true);
    setError("");
    const { ok, payload } = await requestMistakes(status, subject, dueOnly);
    if (ok && isApiSuccess(payload)) {
      setData(payload.data);
      setResults({});
    } else {
      setError(getApiErrorMessage(payload, "ভুলের খাতা লোড করা যায়নি।"));
    }
    setLoading(false);
  }, [dueOnly, status, subject]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { ok, payload } = await requestMistakes(status, subject, dueOnly);
      if (!active) return;
      if (ok && isApiSuccess(payload)) {
        setData(payload.data);
        setResults({});
        setError("");
      } else {
        setError(getApiErrorMessage(payload, "ভুলের খাতা লোড করা যায়নি।"));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [dueOnly, status, subject]);

  useEffect(() => {
    if (!loading && data && !viewTracked.current) {
      viewTracked.current = true;
      trackStudentEvent("student_mistakes_viewed", "mistake_notebook", {
        active_count: data.summary.active,
        due_count: data.summary.due,
      });
    }
  }, [data, loading]);

  async function answerMistake(mistake: Mistake, selectedIndex: number) {
    if (results[mistake.id] || submittingId) return;
    setSubmittingId(mistake.id);
    const { ok, payload } = await apiFetch<AnswerResult>("/api/learning/mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mistakeId: mistake.id, selectedIndex }),
    });
    if (ok && isApiSuccess(payload)) {
      setResults((current) => ({ ...current, [mistake.id]: payload.data }));
      trackStudentEvent("student_mistake_answered", "mistake_notebook", {
        is_correct: payload.data.isCorrect,
        subject: mistake.subject,
      });
    } else {
      setError(getApiErrorMessage(payload, "উত্তরটি জমা দেওয়া যায়নি।"));
    }
    setSubmittingId(null);
  }

  const completedInView = Object.keys(results).length;
  const correctInView = useMemo(
    () => Object.values(results).filter((result) => result.isCorrect).length,
    [results],
  );

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-700 via-brand-red to-orange-500 p-5 text-white shadow-[var(--shadow-lg)] sm:p-7">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/80">
          <NotebookPen className="size-4" />
          স্মার্ট রিভিশন
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-4xl">আমার ভুলের খাতা</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
          ভুল ও বাদ দেওয়া প্রশ্নগুলো এখানে নিজে থেকেই জমা হয়। ঠিক সময়ে আবার
          উত্তর দিলে প্রশ্নটি ধীরে ধীরে আয়ত্তে চলে যাবে।
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "সক্রিয় ভুল",
            value: data?.summary.active ?? 0,
            icon: RotateCcw,
            tone: "border-rose-200 bg-rose-50 text-rose-700",
          },
          {
            label: "আজ রিভিশন",
            value: data?.summary.due ?? 0,
            icon: Clock3,
            tone: "border-amber-200 bg-amber-50 text-amber-700",
          },
          {
            label: "আয়ত্ত হয়েছে",
            value: data?.summary.mastered ?? 0,
            icon: Trophy,
            tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={cn("rounded-2xl border p-4", tone)}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold">{label}</span>
              <Icon className="size-5" />
            </div>
            <p className="mt-2 text-3xl font-black text-primary">{value}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Filter className="size-4 text-muted" />
        <button
          type="button"
          onClick={() => setStatus("active")}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-bold transition",
            status === "active" ? "bg-primary text-white" : "bg-secondary text-primary",
          )}
        >
          শেখা বাকি
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("mastered");
            setDueOnly(false);
          }}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-bold transition",
            status === "mastered" ? "bg-primary text-white" : "bg-secondary text-primary",
          )}
        >
          আয়ত্ত হয়েছে
        </button>
        <button
          type="button"
          onClick={() => setDueOnly((current) => !current)}
          disabled={status === "mastered"}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-40",
            dueOnly ? "bg-amber-500 text-primary" : "bg-amber-50 text-amber-800",
          )}
        >
          শুধু আজকের রিভিশন
        </button>
        <select
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="min-h-9 rounded-lg border border-border bg-white px-3 text-xs font-bold text-primary"
          aria-label="বিষয় বাছাই"
        >
          <option value="">সব বিষয়</option>
          {data?.subjects.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {completedInView > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">
            এই সেশনে {completedInView}টি রিভিশন · {correctInView}টি সঠিক
          </p>
          <button
            type="button"
            onClick={() => void loadMistakes()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
          >
            <RefreshCw className="size-3.5" />
            তালিকা আপডেট করুন
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-56 animate-pulse rounded-2xl bg-secondary/60" />
          ))}
        </div>
      ) : data?.mistakes.length ? (
        <div className="space-y-4">
          {data.mistakes.map((mistake, index) => {
            const result = results[mistake.id];
            return (
              <article
                key={mistake.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex flex-wrap gap-2 text-2xs font-bold">
                        <span className="rounded-full bg-secondary px-2 py-1 text-primary">
                          {mistake.subject}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-muted">
                          {mistake.chapter}
                        </span>
                      </div>
                      <h2 className="mt-3 text-sm font-black leading-6 text-primary sm:text-base">
                        {mistake.question}
                      </h2>
                    </div>
                  </div>
                  <span className="text-2xs font-bold text-muted">
                    আগে {mistake.wrongCount} বার ভুল
                  </span>
                </div>

                {mistake.imageUrl && (
                  <Image
                    src={mistake.imageUrl}
                    alt="প্রশ্নের ছবি"
                    width={768}
                    height={512}
                    className="mt-4 max-h-64 w-auto rounded-xl border border-border object-contain"
                  />
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {mistake.options.map((option, optionIndex) => {
                    const isCorrectOption = result?.correctIndex === optionIndex;
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        disabled={Boolean(result) || submittingId === mistake.id}
                        onClick={() => void answerMistake(mistake, optionIndex)}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition",
                          result
                            ? isCorrectOption
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : "border-border bg-slate-50 text-muted"
                            : "border-border bg-white text-primary hover:border-primary/30 hover:bg-secondary/40",
                        )}
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-current text-xs font-black">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        {option}
                        {isCorrectOption && <Check className="ml-auto size-4" />}
                      </button>
                    );
                  })}
                </div>

                {result && (
                  <div
                    className={cn(
                      "mt-4 rounded-xl border p-4",
                      result.isCorrect
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-black">
                      {result.isCorrect ? (
                        <>
                          <CheckCircle2 className="size-5 text-emerald-700" />
                          <span className="text-emerald-900">সঠিক উত্তর!</span>
                        </>
                      ) : (
                        <>
                          <X className="size-5 text-red-700" />
                          <span className="text-red-900">আবার চেষ্টা করতে হবে</span>
                        </>
                      )}
                    </div>
                    {result.explanation && (
                      <p className="mt-2 text-xs leading-6 text-muted">
                        <strong className="text-primary">ব্যাখ্যা:</strong>{" "}
                        {result.explanation}
                      </p>
                    )}
                    <p className="mt-2 text-2xs font-bold text-muted">
                      {result.status === "mastered"
                        ? "প্রশ্নটি আয়ত্ত হয়েছে।"
                        : `পরবর্তী রিভিশন: ${new Date(result.nextReviewAt).toLocaleDateString("bn-BD")}`}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <h2 className="mt-3 text-lg font-black text-primary">
            {dueOnly ? "আজ আর কোনো রিভিশন বাকি নেই" : "এই তালিকায় কোনো প্রশ্ন নেই"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            নতুন MCQ অনুশীলনের ভুল প্রশ্ন এখানে নিজে থেকেই যোগ হবে।
          </p>
        </div>
      )}
    </section>
  );
}
