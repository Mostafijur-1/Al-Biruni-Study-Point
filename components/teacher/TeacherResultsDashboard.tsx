"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LineChart,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WrongAnswer = {
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  explanation: string | null;
};

type StudentResult = {
  id: string;
  student: {
    id: string;
    name: string;
    phone: string | null;
    class: string | null;
    level: "ssc" | "hsc" | null;
    schoolCollege: string | null;
  };
  subject: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
  isCancelled?: boolean;
  timeTaken: number;
  submittedAt: string;
  teacherComment?: string;
  deletedByTeacher?: boolean;
  wrongAnswers: WrongAnswer[];
};

type ResultsResponse = {
  results: StudentResult[];
  total: number;
  page: number;
  limit: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CLASS_LABELS: Record<string, string> = {
  "class-9": "Class 9",
  "class-10": "Class 10",
  "class-11": "Class 11",
  "class-12": "Class 12",
};

const OPTION_LABELS = ["ক", "খ", "গ", "ঘ"];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Wrong answers expander
// ---------------------------------------------------------------------------
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
                <span className="ml-auto text-xs font-bold text-red-600 shrink-0">✗ দেওয়া হয়েছে</span>
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

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------
function ResultRow({
  result, onCommentSaved,
  onDeleted,
}: {
  result: StudentResult;
    onCommentSaved: (id: string, comment: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState(result.teacherComment || "");
  const [commentSaving, setCommentSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasWrong = result.wrongAnswers.length > 0;

  useEffect(() => {
    setCommentText(result.teacherComment || "");
  }, [result.teacherComment]);

  async function handleSaveComment() {
    setCommentSaving(true);
    try {
      const { ok, payload } = await apiFetch(`/api/teacher/results/${result.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherComment: commentText }),
      });
      if (ok && isApiSuccess(payload)) {
        onCommentSaved(result.id, commentText);
      } else {
        alert("Could not save comment");
      }
    } catch {
      alert("Error saving comment");
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleDeleteAttempt() {
    setIsDeleting(true);
    try {
      const { ok, payload } = await apiFetch(`/api/teacher/results/${result.id}`, {
        method: "DELETE",
      });
      if (ok && isApiSuccess(payload)) {
        onDeleted(result.id);
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
      className={cn(
        "rounded-xl border-2 bg-card transition-all duration-200",
        result.isCancelled
          ? "border-red-200/60 bg-red-50/10"
          : result.isPassed
          ? "border-emerald-200 bg-emerald-50/5"
          : "border-orange-200/60 bg-orange-50/10"
      )}
    >
      {/* Summary row */}
      <div
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 w-full">
          {/* Avatar */}
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <User className="size-4" />
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <p className="font-semibold text-primary truncate max-w-[150px] sm:max-w-none">
                  {result.student.name}
                </p>
                {result.student.class && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-accent uppercase shrink-0">
                    {CLASS_LABELS[result.student.class] ?? result.student.class}
                  </span>
                )}
              </div>

              {/* Mobile-only score display */}
              <div className="flex items-center gap-2 sm:hidden shrink-0">
                <span
                  className={cn(
                    "text-base font-extrabold",
                    result.isCancelled
                      ? "text-brand-red"
                      : result.isPassed
                      ? "text-emerald-600"
                      : "text-orange-500"
                  )}
                >
                  {result.score}/{result.totalQuestions}
                </span>
                {result.isCancelled ? (
                  <XCircle className="size-4 text-brand-red" />
                ) : result.isPassed ? (
                  <TrendingUp className="size-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="size-4 text-orange-500" />
                )}
              </div>
            </div>

            {result.student.schoolCollege && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/95">
                <span className="font-semibold text-foreground/80">{result.student.schoolCollege}</span>
              </p>
            )}
            
            {/* Wrapping flex details for perfect mobile display without truncation */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted mt-1.5 sm:mt-1">
              <span className="font-semibold text-primary/80 bg-primary/5 rounded px-1.5 py-0.5 sm:bg-transparent sm:p-0">
                {result.subject}
              </span>
              <span className="hidden sm:inline text-muted/40">•</span>
              <span>{formatDate(result.submittedAt)}</span>
              <span className="text-muted/40">•</span>
              <span>{formatTime(result.timeTaken)}</span>
              {result.teacherComment && (
                <span className="ml-1 inline-flex items-center rounded bg-brand-yellow/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                  Commented
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right actions and stats (Desktop only) */}
        <div className="hidden sm:flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                result.isCancelled
                  ? "text-brand-red"
                  : result.isPassed
                  ? "text-emerald-600"
                  : "text-orange-500"
              )}
            >
              {result.score}/{result.totalQuestions}
            </p>
            <p className="text-xs text-muted">{result.percentage}%</p>
          </div>

          {result.isCancelled ? (
            <XCircle className="size-5 text-brand-red shrink-0" />
          ) : result.isPassed ? (
            <TrendingUp className="size-5 text-emerald-500 shrink-0" />
          ) : (
            <TrendingDown className="size-5 text-orange-500 shrink-0" />
          )}

          {/* Inline header buttons: Comment & Delete */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setCommentOpen((o) => !o);
                if (expanded) setExpanded(false);
              }}
              className={cn(
                "p-1.5 rounded-lg border text-muted transition hover:bg-secondary hover:text-primary cursor-pointer",
                (commentOpen || result.teacherComment) ? "border-brand-yellow bg-brand-yellow/10 text-accent-foreground" : "border-border bg-surface"
              )}
              title="Add/Edit Comment"
            >
              <MessageSquare className="size-4" />
            </button>

            {/* No inline layout-shift confirmation */}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg border border-red-150 bg-red-50 text-brand-red hover:bg-red-100 transition cursor-pointer"
              title="Delete Attempt"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <ChevronDown
            className={cn(
              "size-4 text-muted transition-transform duration-200 shrink-0",
              expanded && "rotate-180"
            )}
          />
        </div>

        {/* Mobile Actions and Chevron Bar (Mobile only) */}
        <div
          className="flex sm:hidden items-center justify-between border-t border-dashed border-border/60 pt-3 mt-1 w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCommentOpen((o) => !o);
                if (expanded) setExpanded(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer",
                (commentOpen || result.teacherComment)
                  ? "border-brand-yellow bg-brand-yellow/10 text-accent-foreground"
                  : "border-border bg-surface text-muted hover:text-primary hover:bg-secondary"
              )}
            >
              <MessageSquare className="size-3.5" />
              <span>Comment</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-150 bg-red-50 text-brand-red text-xs font-semibold hover:bg-red-100 transition cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Delete</span>
            </button>
          </div>

          {/* Chevron toggler */}
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 text-xs text-muted font-bold hover:text-primary py-1.5 px-2 rounded-md transition cursor-pointer"
          >
            <span>{expanded ? "Collapse" : "Expand"}</span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {/* Expanded wrong answers panel */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 bg-secondary/5 space-y-3">
          {hasWrong ? (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-red">
                <XCircle className="size-3.5" />
                {result.wrongAnswers.length} টি ভুল উত্তর (Wrong Answers)
              </p>
              <div className="space-y-3">
                {result.wrongAnswers.map((wa, idx) => (
                  <WrongAnswerCard key={idx} wa={wa} index={idx} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-emerald-700">✓ কোনো ভুল উত্তর নেই! সব প্রশ্নের সঠিক উত্তর দিয়েছে।</p>
          )}
        </div>
      )}

      {/* Comment panel (visible if expanded or commentOpen is true) */}
      {(expanded || commentOpen) && (
        <div className="border-t border-border px-4 pb-4 pt-3 bg-secondary/10 rounded-b-xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">শিক্ষক মন্তব্য (Teacher's Comment)</p>
          
          <div className="flex flex-col sm:flex-row gap-2" onClick={(e) => e.stopPropagation()}>
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
      )}

      {/* Delete Confirmation Modal Overlay to prevent inline shifting */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(false);
          }}
        >
          <div
            className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <Trash2 className="size-5 text-brand-red" />
              Confirm Deletion
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Are you sure you want to delete the result attempt for <strong>{result.student.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAttempt}
                disabled={isDeleting}
                className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export function TeacherResultsDashboard() {
      const [results, setResults] = useState<StudentResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDate, setFilterDate] = useState("today");
  const [searchName, setSearchName] = useState("");

  // Teacher domain configuration
  const [teacherDomain, setTeacherDomain] = useState<{
    isAll: boolean;
    classes: string[];
    subjects: string[];
  } | null>(null);

  const limit = 20;

  const handleCommentSaved = useCallback((id: string, comment: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, teacherComment: comment } : r))
    );
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterClass) params.set("class", filterClass);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterDate) params.set("date", filterDate);

      const { ok, payload } = await apiFetch<ResultsResponse & { domain?: any }>(
        `/api/teacher/results?${params}`
      );
      if (ok && isApiSuccess(payload)) {
        console.log("DEBUG results from API:", payload.data.results);
        setResults(payload.data.results);
        setTotal(payload.data.total);
        if (payload.data.domain) {
          setTeacherDomain(payload.data.domain);
        }
      } else {
        setError(getApiErrorMessage(payload, "Could not load results."));
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [page, filterClass, filterSubject, filterDate]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Client-side name search filter
  const filtered = searchName.trim()
    ? results.filter((r) =>
        r.student.name.toLowerCase().includes(searchName.toLowerCase()) ||
        (r.student.phone ?? "").includes(searchName)
      )
    : results;

  const totalPages = Math.ceil(total / limit);

  // Determine allowed classes to display
  const allowedClasses = teacherDomain
    ? teacherDomain.isAll
      ? ["class-9", "class-10", "class-11", "class-12"]
      : teacherDomain.classes
    : ["class-9", "class-10", "class-11", "class-12"]; // fallback before loading

  // Determine allowed subjects to display
  let allowedSubjects: string[] = [];
  if (teacherDomain) {
    if (teacherDomain.isAll) {
      if (filterClass) {
        allowedSubjects = getAvailableSubjectsForClasses([filterClass]);
      } else {
        allowedSubjects = [
          "Physics",
          "Chemistry",
          "Math",
          "Higher Math",
          "ICT",
          "Physics 1st Paper",
          "Physics 2nd Paper",
          "Chemistry 1st Paper",
          "Chemistry 2nd Paper",
          "Higher Math 1st Paper",
          "Higher Math 2nd Paper",
        ];
      }
    } else {
      const targetClasses = filterClass ? [filterClass] : teacherDomain.classes;
      const classSyllabusSubjects = getAvailableSubjectsForClasses(targetClasses);
      allowedSubjects = teacherDomain.subjects.filter((sub) =>
        classSyllabusSubjects.includes(sub)
      );
    }
  } else {
    allowedSubjects = [
      "Physics",
      "Chemistry",
      "Math",
      "Higher Math",
      "ICT",
      "Physics 1st Paper",
      "Physics 2nd Paper",
      "Chemistry 1st Paper",
      "Chemistry 2nd Paper",
      "Higher Math 1st Paper",
      "Higher Math 2nd Paper",
    ];
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
            <LineChart className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Teacher Panel</p>
            <h1 className="font-display text-2xl font-bold text-primary">Student Results</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted leading-6">
          শিক্ষার্থীদের MCQ প্র্যাকটিসের পারফরম্যান্স দেখুন। যেকোনো রেজাল্টে ক্লিক করে ভুল উত্তরগুলো বিস্তারিত দেখুন। 
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <input
              type="text"
              placeholder="Search student name / phone..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Class filter */}
          <select
            value={filterClass}
            onChange={(e) => {
              const newClass = e.target.value;
              setFilterClass(newClass);
              setPage(1);

              // Validate and reset subject if not available in new class context
              if (teacherDomain) {
                const targetClasses = newClass
                  ? [newClass]
                  : teacherDomain.isAll
                  ? ["class-9", "class-10", "class-11", "class-12"]
                  : teacherDomain.classes;
                const classSyllabusSubjects = getAvailableSubjectsForClasses(targetClasses);
                const validSubjects = teacherDomain.isAll
                  ? classSyllabusSubjects
                  : teacherDomain.subjects.filter((sub) => classSyllabusSubjects.includes(sub));

                if (filterSubject && !validSubjects.includes(filterSubject)) {
                  setFilterSubject("");
                }
              }
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="">All Classes</option>
            {allowedClasses.map((cls) => (
              <option key={cls} value={cls}>
                {CLASS_LABELS[cls] ?? cls}
              </option>
            ))}
          </select>

          {/* Subject filter */}
          <select
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="">All Subjects</option>
            {allowedSubjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>

          {/* Date filter */}
          <select
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last-7-days">Last 7 Days</option>
            <option value="last-30-days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>

          <button
            type="button"
            onClick={fetchResults}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted hover:bg-secondary hover:text-primary transition disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats summary */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total Attempts",
              value: total,
              icon: BookOpen,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              label: "Showing",
              value: filtered.length,
              icon: GraduationCap,
              color: "text-accent",
              bg: "bg-accent/10",
            },
            {
              label: "Passed",
              value: filtered.filter((r) => r.isPassed).length,
              icon: TrendingUp,
              color: "text-emerald-600",
              bg: "bg-emerald-100",
            },
            {
              label: "Needs Work",
              value: filtered.filter((r) => !r.isPassed && !r.isCancelled).length,
              icon: TrendingDown,
              color: "text-orange-500",
              bg: "bg-orange-100",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
              <div className={cn("mb-2 grid size-8 place-items-center rounded-lg", bg)}>
                <Icon className={cn("size-4", color)} />
              </div>
              <p className="text-2xl font-bold text-primary">{value}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-5">
          {/* Stats summary skeleton */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card/45 p-4 shadow-[var(--shadow-sm)] animate-pulse space-y-3">
                <div className="size-8 rounded-lg bg-secondary animate-pulse" />
                <div className="h-8 w-1/3 rounded bg-secondary animate-pulse" />
                <div className="h-3.5 w-1/2 rounded bg-secondary animate-pulse" />
              </div>
            ))}
          </div>

          {/* Attempts list skeleton */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-secondary" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-secondary" />
                    <div className="h-3 w-1/2 rounded bg-secondary" />
                  </div>
                  <div className="size-10 rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <GraduationCap className="size-10 text-muted/40 mb-3" />
          <p className="font-semibold text-primary">No results found</p>
          <p className="mt-1 text-sm text-muted max-w-xs">
            {filterClass || filterSubject || searchName
              ? "Try changing your filters."
              : "No students have submitted practice attempts yet, or your domain has not been configured by the admin."}
          </p>
        </div>
      )}

      {/* Result rows */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((result) => (
            <ResultRow
              key={result.id}
              result={result}
              onCommentSaved={handleCommentSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
          <p className="text-xs text-muted">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-secondary hover:text-primary transition disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-secondary hover:text-primary transition disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function getAvailableSubjectsForClasses(classes: string[]): string[] {
  const subjectsSet = new Set<string>();
  if (classes.includes("class-9") || classes.includes("class-10")) {
    subjectsSet.add("Physics");
    subjectsSet.add("Chemistry");
    subjectsSet.add("Math");
    subjectsSet.add("Higher Math");
    subjectsSet.add("ICT");
  }
  if (classes.includes("class-11") || classes.includes("class-12")) {
    subjectsSet.add("Physics 1st Paper");
    subjectsSet.add("Physics 2nd Paper");
    subjectsSet.add("Chemistry 1st Paper");
    subjectsSet.add("Chemistry 2nd Paper");
    subjectsSet.add("Higher Math 1st Paper");
    subjectsSet.add("Higher Math 2nd Paper");
    subjectsSet.add("ICT");
  }
  const orderedSubjects = [
    "Physics",
    "Chemistry",
    "Math",
    "Higher Math",
    "Physics 1st Paper",
    "Physics 2nd Paper",
    "Chemistry 1st Paper",
    "Chemistry 2nd Paper",
    "Higher Math 1st Paper",
    "Higher Math 2nd Paper",
    "ICT",
  ];
  return orderedSubjects.filter((sub) => subjectsSet.has(sub));
}
