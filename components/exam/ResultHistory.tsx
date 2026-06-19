"use client";

import { useState } from "react";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import type { McqResultStudent } from "@/types/mcq";
import { Button } from "@/components/ui/button";
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  MessageSquare,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SolutionDetail = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  selectedIndex: number | null;
  isCorrect: boolean;
};

type AttemptDetail = {
  _id: string;
  score: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number;
  submittedAt: string;
  teacherComment?: string;
  commentedBy?: { name: string };
  exam: {
    title: string;
    totalMarks: number;
    passMark: number;
  };
};

export function ResultHistory() {
  const { data, message, isLoading } = useApiQuery<{ results: McqResultStudent[] }>("/api/mcq/results", {
    loadingMessage: "Loading results...",
    errorMessage: "Could not load results.",
  });

  const results = data?.results ?? [];

  // Solutions Modal State
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);
  const [solutions, setSolutions] = useState<SolutionDetail[]>([]);

  const handleOpenSolutions = async (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setModalLoading(true);
    setModalError("");
    setAttemptDetail(null);
    setSolutions([]);

    try {
      const { ok, payload } = await apiFetch<{
        attempt: AttemptDetail;
        solutions: SolutionDetail[];
      }>(`/api/mcq/results/${attemptId}`);

      if (ok && isApiSuccess(payload)) {
        setAttemptDetail(payload.data.attempt);
        setSolutions(payload.data.solutions);
      } else {
        setModalError(getApiErrorMessage(payload, "Failed to load solutions."));
      }
    } catch {
      setModalError("Network error loading solutions.");
    } finally {
      setModalLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-border bg-card/45 p-5 space-y-4 shadow-[var(--shadow-sm)]"
          >
            <div className="h-6 w-1/3 rounded bg-secondary animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-secondary animate-pulse" />
            <div className="h-8 w-full rounded-xl bg-secondary animate-pulse mt-4" />
          </div>
        ))}
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
        {message}
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted font-bold">
        No results found.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {results.map((result: any) => {
        const isPractice = result.isPractice ?? false;
        return (
          <article
            key={result._id}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition duration-200"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider",
                    isPractice
                      ? "bg-secondary text-primary border border-primary/10"
                      : "bg-purple-50 text-purple-800 border border-purple-100"
                  )}
                >
                  {isPractice ? "MCQ Test (Practice)" : "MCQ Exam"}
                </span>
                <span className="text-3xs font-bold text-muted flex items-center gap-1">
                  <Calendar className="size-3 text-muted" />
                  {new Date(result.submittedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h2 className="font-display text-base font-bold text-primary leading-snug line-clamp-1">
                {result.exam?.title || "Practice Session"}
              </h2>

              <div className="grid grid-cols-2 gap-2 text-2xs font-semibold text-muted bg-surface/50 p-2.5 rounded-xl border border-border/40">
                <span className="flex items-center gap-1 text-primary">
                  <Award className="size-3.5 text-brand-yellow" />
                  Score: {result.score}/{result.exam?.totalMarks || "-"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5 text-primary" />
                  Time: {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s
                </span>
                <span className="flex items-center gap-1 col-span-2 mt-1">
                  <CheckCircle2
                    className={cn(
                      "size-3.5",
                      result.isPassed ? "text-emerald-500" : "text-brand-red"
                    )}
                  />
                  <span>
                    Status:{" "}
                    <strong className={result.isPassed ? "text-emerald-700" : "text-brand-red"}>
                      {result.isPassed ? "Passed" : "Failed"}
                    </strong>{" "}
                    ({result.percentage}%)
                  </span>
                </span>
              </div>

              {result.teacherComment && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-1">
                  <span className="text-3xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <MessageSquare className="size-3 text-amber-700" />
                    Teacher's Feedback
                  </span>
                  <p className="text-xs text-amber-900 font-medium italic">
                    "{result.teacherComment}"
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5">
              {!isPractice ? (
                <Button
                  onClick={() => handleOpenSolutions(result._id)}
                  variant="outline"
                  className="w-full rounded-xl py-2 text-xs font-bold border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 flex items-center justify-center gap-1"
                >
                  <Eye className="size-3.5" />
                  View Answers & Explanations
                </Button>
              ) : (
                <div className="text-center py-2 text-3xs font-bold text-muted uppercase tracking-wider bg-secondary/30 rounded-xl">
                  Answers hidden after test
                </div>
              )}
            </div>
          </article>
        );
      })}

      {/* Solutions Review Modal */}
      {selectedAttemptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col justify-between animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 pb-3.5">
              <div>
                <span className="text-3xs font-bold uppercase tracking-wider text-muted">
                  Reviewing Solutions
                </span>
                <h3 className="font-display text-base md:text-lg font-bold text-primary leading-tight mt-0.5">
                  {attemptDetail ? attemptDetail.exam.title : "Loading Exam Details..."}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAttemptId(null)}
                className="text-muted hover:text-primary transition font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4">
              {modalLoading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <RefreshCw className="size-8 animate-spin text-primary" />
                  <p className="text-xs font-semibold text-muted">Loading solution sheet...</p>
                </div>
              )}

              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700">
                  {modalError}
                </div>
              )}

              {attemptDetail && (
                <div className="grid grid-cols-3 gap-2.5 text-3xs font-bold text-muted border-b border-border/40 pb-4">
                  <div className="bg-secondary/40 border border-border/40 rounded-lg p-2 text-center">
                    <span className="block uppercase tracking-wider text-muted mb-0.5">Score</span>
                    <span className="text-sm font-black text-primary">
                      {attemptDetail.score} / {attemptDetail.exam.totalMarks}
                    </span>
                  </div>
                  <div className="bg-secondary/40 border border-border/40 rounded-lg p-2 text-center">
                    <span className="block uppercase tracking-wider text-muted mb-0.5">Percentage</span>
                    <span className="text-sm font-black text-primary">
                      {attemptDetail.percentage}%
                    </span>
                  </div>
                  <div className="bg-secondary/40 border border-border/40 rounded-lg p-2 text-center">
                    <span className="block uppercase tracking-wider text-muted mb-0.5">Time Taken</span>
                    <span className="text-sm font-black text-primary">
                      {Math.floor(attemptDetail.timeTaken / 60)}m {attemptDetail.timeTaken % 60}s
                    </span>
                  </div>
                </div>
              )}

              {!modalLoading && !modalError && solutions.length > 0 && (
                <div className="space-y-4">
                  {solutions.map((sol, idx) => {
                    const hasAnswered = sol.selectedIndex !== null;
                    const isCorrect = sol.isCorrect;

                    return (
                      <article
                        key={sol.id}
                        className={cn(
                          "rounded-xl border p-4 space-y-3",
                          !hasAnswered
                            ? "border-amber-100 bg-amber-50/20"
                            : isCorrect
                              ? "border-emerald-100 bg-emerald-50/10"
                              : "border-red-100 bg-red-50/10"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded text-3xs font-bold text-white mt-0.5",
                              !hasAnswered
                                ? "bg-amber-500"
                                : isCorrect
                                  ? "bg-emerald-600"
                                  : "bg-brand-red"
                            )}
                          >
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <h4 className="text-xs md:text-sm font-bold text-primary leading-snug">
                              {sol.question}
                            </h4>
                            {!hasAnswered && (
                              <span className="inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-3xs font-bold text-amber-800 uppercase tracking-wider mt-1.5">
                                Unanswered
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Options List */}
                        <div className="grid gap-2 pl-8 text-xs font-semibold">
                          {sol.options.map((opt, optIdx) => {
                            const isCorrectOpt = optIdx === sol.correctIndex;
                            const isStudentOpt = optIdx === sol.selectedIndex;

                            return (
                              <div
                                key={optIdx}
                                className={cn(
                                  "flex items-center justify-between rounded-lg border p-2.5",
                                  isCorrectOpt
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-950 font-bold"
                                    : isStudentOpt
                                      ? "border-brand-red/35 bg-red-50 text-red-950"
                                      : "border-border bg-secondary/15 text-muted/80"
                                )}
                              >
                                <span>
                                  {String.fromCharCode(65 + optIdx)}. {opt}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isCorrectOpt && (
                                    <span className="rounded-full bg-emerald-600 p-0.5 text-white">
                                      <Check className="size-3" strokeWidth={3} />
                                    </span>
                                  )}
                                  {isStudentOpt && !isCorrectOpt && (
                                    <span className="rounded-full bg-brand-red p-0.5 text-white">
                                      <X className="size-3" strokeWidth={3} />
                                    </span>
                                  )}
                                  {isStudentOpt && (
                                    <span className="text-3xs font-black uppercase tracking-wider px-1 text-primary opacity-60">
                                      Your choice
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        {sol.explanation && (
                          <div className="mt-2.5 rounded-lg border border-border/50 bg-secondary/20 p-3 text-3xs md:text-2xs text-muted leading-relaxed font-semibold pl-8">
                            <strong className="text-primary font-bold">Explanation:</strong>{" "}
                            {sol.explanation}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border/80 pt-3.5 flex justify-end">
              <Button onClick={() => setSelectedAttemptId(null)} className="rounded-xl font-bold">
                Close Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
