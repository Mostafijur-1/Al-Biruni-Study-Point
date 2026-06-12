"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Trash2 } from "lucide-react";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import { formatDurationSeconds } from "@/lib/format/time";
import type { McqResultTeacherRow } from "@/types/mcq";
import { apiFetch, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type TeacherMcqResultsProps = {
  locale: Locale;
  examId: string;
};

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
                (expanded || row.teacherComment) ? "border-brand-yellow bg-brand-yellow/10 text-accent-foreground" : "border-border bg-white"
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
                  className="rounded border border-border bg-white px-2 py-0.5 text-[9px] font-bold text-muted hover:bg-secondary cursor-pointer"
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
            <div className="space-y-3 p-3 bg-white/60 rounded-xl border border-border/80 my-1 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">শিক্ষক মন্তব্য (Teacher's Comment)</p>
              
              {/* Comment edit input */}
              <div className="flex flex-col sm:flex-row gap-2 max-w-3xl" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="শিক্ষার্থীর জন্য মন্তব্য লিখুন... (Write a comment for the student)"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
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
          </td>
        </tr>
      )}
    </>
  );
}

export function TeacherMcqResults({ locale, examId }: TeacherMcqResultsProps) {
  const path = createLocalizedPath(locale);
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

      {isLoading ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm)] animate-pulse">
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
      ) : message ? (
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
      )}
    </div>
  );
}
