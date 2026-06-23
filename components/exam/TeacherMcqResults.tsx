"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Trash2, XCircle } from "lucide-react";

import { useApiQuery } from "@/lib/hooks/use-api-query";

import { formatDurationSeconds } from "@/lib/format/time";
import type { McqResultTeacherRow } from "@/types/mcq";
import { apiFetch, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type TeacherMcqResultsProps = {
    examId: string;
};

const OPTION_LABELS = ["ক", "খ", "গ", "ঘ"];

type WrongAnswer = {
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  explanation: string | null;
};

function WrongAnswerCard({ wa, index }: { wa: WrongAnswer; index: number }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
      <p className="text-sm font-semibold text-red-900 leading-snug">
        <span className="inline-flex size-5 items-center justify-center rounded bg-red-200 text-red-800 text-xs font-bold mr-1.5">
          {index + 1}
        </span>
        {wa.question}
      </p>

      <div className="mt-3 grid gap-1.5">
        {wa.options.map((opt, i) => {
          const isSelected = i === wa.selectedIndex;
          const isCorrect = i === wa.correctIndex;
          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-sm border",
                isCorrect
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold"
                  : isSelected
                  ? "border-red-300 bg-red-100 text-red-800"
                  : "border-transparent bg-card/60 text-muted"
              )}
            >
              <span className="shrink-0 font-bold">{OPTION_LABELS[i] ?? String.fromCharCode(65 + i)}.</span>
              <span>{opt}</span>
              {isCorrect && (
                <span className="ml-auto text-xs font-bold text-emerald-700 shrink-0">✓ সঠিক</span>
              )}
              {isSelected && !isCorrect && (
                <span className="ml-auto text-xs font-bold text-red-600 shrink-0">✗ দেওয়া হয়েছে</span>
              )}
            </div>
          );
        })}
      </div>

      {wa.explanation && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">ব্যাখ্যা</p>
          <p className="text-sm text-emerald-900 leading-relaxed">{wa.explanation}</p>
        </div>
      )}
    </div>
  );
}

function McqResultRow({
  row,
  onDelete,
  onCommentSave,
}: {
  row: McqResultTeacherRow;
  onDelete: (id: string) => void;
  onCommentSave: (id: string, comment: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState(row.teacherComment || "");
  const [commentSaving, setCommentSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setCommentText(row.teacherComment || "");
  }, [row.teacherComment]);

  async function handleSaveComment() {
    setCommentSaving(true);
    try {
      const { ok, payload } = await apiFetch(`/api/mcq/results/${row._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherComment: commentText }),
      });
      if (ok && isApiSuccess(payload)) {
        onCommentSave(row._id, commentText);
      } else {
        alert("Could not save comment");
      }
    } catch {
      alert("Error saving comment");
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleDeleteResult() {
    setIsDeleting(true);
    try {
      const { ok, payload } = await apiFetch(`/api/mcq/results/${row._id}`, {
        method: "DELETE",
      });
      if (ok && isApiSuccess(payload)) {
        onDelete(row._id);
      } else {
        alert("Could not delete result");
      }
    } catch {
      alert("Error deleting result");
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="border-b border-border hover:bg-secondary/20 cursor-pointer transition"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-primary">{row.student?.name || "Unknown"}</span>
            {row.teacherComment && (
              <span className="inline-flex items-center rounded bg-brand-yellow/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground animate-pulse">
                Commented
              </span>
            )}
          </div>
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
        <td className="px-4 py-3 text-muted font-sans text-xs">
          {new Date(row.submittedAt).toLocaleString()}
        </td>
        {/* Actions Cell */}
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "p-1.5 rounded-lg border text-muted transition hover:bg-secondary hover:text-primary cursor-pointer",
                (expanded || row.teacherComment) ? "border-brand-yellow bg-brand-yellow/10 text-accent-foreground" : "border-border bg-surface"
              )}
              title="Add/Edit Comment"
            >
              <MessageSquare className="size-3.5" />
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg p-0.5 text-left">
                <span className="text-[9px] text-brand-red font-bold px-1">Delete?</span>
                <button
                  type="button"
                  onClick={handleDeleteResult}
                  disabled={isDeleting}
                  className="rounded bg-brand-red px-2 py-0.5 text-[9px] font-bold text-white hover:bg-brand-red-hover cursor-pointer"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded border border-border bg-surface px-2 py-0.5 text-[9px] font-bold text-muted hover:bg-secondary cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg border border-red-150 bg-red-50 text-brand-red hover:bg-red-100 transition cursor-pointer"
                title="Delete Result"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-secondary/5">
          <td colSpan={8} className="px-4 py-3">
            <div className="space-y-4 p-4 bg-surface/60 rounded-xl border border-border/80 my-1 shadow-2xs">
              
              {/* Wrong Answers List */}
              {row.wrongAnswers && row.wrongAnswers.length > 0 ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-red">
                    <XCircle className="size-3.5 animate-pulse" />
                    {row.wrongAnswers.length} টি ভুল উত্তর (Wrong Answers)
                  </p>
                  <div className="space-y-3">
                    {row.wrongAnswers.map((wa, idx) => (
                      <WrongAnswerCard key={idx} wa={wa} index={idx} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-emerald-700">✓ কোনো ভুল উত্তর নেই! সব প্রশ্নের সঠিক উত্তর দিয়েছে।</p>
              )}

              {/* Teacher Comment Section */}
              <div className="border-t border-border/50 pt-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">শিক্ষক মন্তব্য (Teacher's Comment)</p>
                
                {/* Comment edit input */}
                <div className="flex flex-col sm:flex-row gap-2 max-w-3xl" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="শিক্ষার্থীর জন্য মন্তব্য লিখুন... (Write a comment for the student)"
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    disabled={commentSaving}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
                  >
                    {commentSaving ? "Saving..." : "Save Comment"}
                  </button>
                </div>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function McqResultMobileCard({
  row,
  onDelete,
  onCommentSave,
}: {
  row: McqResultTeacherRow;
  onDelete: (id: string) => void;
  onCommentSave: (id: string, comment: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState(row.teacherComment || "");
  const [commentSaving, setCommentSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setCommentText(row.teacherComment || "");
  }, [row.teacherComment]);

  async function handleSaveComment() {
    setCommentSaving(true);
    try {
      const { ok, payload } = await apiFetch(`/api/mcq/results/${row._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherComment: commentText }),
      });
      if (ok && isApiSuccess(payload)) {
        onCommentSave(row._id, commentText);
      } else {
        alert("Could not save comment");
      }
    } catch {
      alert("Error saving comment");
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleDeleteResult() {
    setIsDeleting(true);
    try {
      const { ok, payload } = await apiFetch(`/api/mcq/results/${row._id}`, {
        method: "DELETE",
      });
      if (ok && isApiSuccess(payload)) {
        onDelete(row._id);
      } else {
        alert("Could not delete result");
      }
    } catch {
      alert("Error deleting result");
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="rounded-2xl border border-border bg-card p-4 shadow-xs hover:shadow-md transition cursor-pointer space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-primary text-sm flex flex-wrap items-center gap-1.5">
            {row.student?.name || "Unknown"}
            {row.teacherComment && (
              <span className="inline-flex items-center rounded bg-brand-yellow/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground animate-pulse">
                Commented
              </span>
            )}
          </h3>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
            Attempt #{row.attemptNo} · {new Date(row.submittedAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wider",
            row.isPassed
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-red-50 text-red-700 border border-red-100"
          )}
        >
          {row.isPassed ? "Passed" : "Failed"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-secondary/30 p-2 rounded-xl text-center text-3xs font-semibold text-muted">
        <div>
          <span className="block text-[8px] uppercase tracking-wider mb-0.5">Score</span>
          <strong className="text-primary text-xs">
            {row.score}{row.exam?.totalMarks != null ? ` / ${row.exam.totalMarks}` : ""}
          </strong>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider mb-0.5">Percentage</span>
          <strong className="text-primary text-xs">{row.percentage.toFixed(1)}%</strong>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider mb-0.5">Duration</span>
          <strong className="text-primary text-xs">{formatDurationSeconds(row.timeTaken)}</strong>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "text-2xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg border cursor-pointer",
            expanded ? "bg-brand-yellow/10 border-brand-yellow text-accent-foreground" : "bg-surface border-border text-muted hover:text-primary"
          )}
        >
          <MessageSquare className="size-3.5" />
          {expanded ? "Hide Details" : "Show Details"}
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg p-0.5 text-left">
            <span className="text-[9px] text-brand-red font-bold px-1">Delete?</span>
            <button
              type="button"
              onClick={handleDeleteResult}
              disabled={isDeleting}
              className="rounded bg-brand-red px-2 py-0.5 text-[9px] font-bold text-white hover:bg-brand-red-hover cursor-pointer"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded border border-border bg-surface px-2 py-0.5 text-[9px] font-bold text-muted hover:bg-secondary cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg border border-red-150 bg-red-50 text-brand-red hover:bg-red-100 transition cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border/40 pt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
          {row.wrongAnswers && row.wrongAnswers.length > 0 ? (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-red">
                <XCircle className="size-3.5" />
                {row.wrongAnswers.length} Wrong Answers
              </p>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {row.wrongAnswers.map((wa, idx) => (
                  <WrongAnswerCard key={idx} wa={wa} index={idx} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-2xs font-bold text-emerald-700">✓ No wrong answers! Correctly answered all questions.</p>
          )}

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Teacher Comment</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={commentSaving}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeacherMcqResults({ examId }: TeacherMcqResultsProps) {
    const { data, message, isLoading, setData } = useApiQuery<{ results: McqResultTeacherRow[] }>(
    `/api/mcq/results?examId=${examId}`,
    {
      loadingMessage: "Loading results...",
      errorMessage: "Could not load results.",
    },
  );

  const results = data?.results ?? [];
  const examTitle = results[0]?.exam?.title;

  function handleDeleteRow(deletedId: string) {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        results: prev.results.filter((r) => r._id !== deletedId),
      };
    });
  }

  function handleCommentSaveRow(id: string, comment: string) {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        results: prev.results.map((r) => (r._id === id ? { ...r, teacherComment: comment } : r)),
      };
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={"/teacher/mcq"}
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Back to MCQ exams
        </Link>
        <Link
          href={`/teacher/mcq/${examId}/edit`}
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

      {isLoading ? (
        <div className="space-y-4">
          {/* Desktop Loading Skeleton Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm)] animate-pulse">
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
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-secondary animate-pulse" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 rounded bg-secondary animate-pulse" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-10 rounded bg-secondary animate-pulse" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-16 rounded-full bg-secondary animate-pulse" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-secondary animate-pulse" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-8 rounded bg-secondary animate-pulse" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-28 rounded bg-secondary animate-pulse" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-7 w-16 rounded-lg bg-secondary inline-block animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Loading Skeleton Cards */}
          <div className="block md:hidden space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-secondary rounded" />
                    <div className="h-3 w-20 bg-secondary rounded" />
                  </div>
                  <div className="h-5 w-14 bg-secondary rounded-full" />
                </div>
                <div className="h-10 bg-secondary rounded-xl" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-8 w-24 bg-secondary rounded-lg" />
                  <div className="h-8 w-8 bg-secondary rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-muted">{message}</p>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-muted">No student submissions yet.</p>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">
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
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <McqResultRow
                    key={row._id}
                    row={row}
                    onDelete={handleDeleteRow}
                    onCommentSave={handleCommentSaveRow}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {results.map((row) => (
              <McqResultMobileCard
                key={row._id}
                row={row}
                onDelete={handleDeleteRow}
                onCommentSave={handleCommentSaveRow}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
