"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Flag,
  Lightbulb,
  MessageSquareText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  Trophy,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { cn } from "@/lib/utils";
import type { McqResultStudent } from "@/types/mcq";

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
  exam: { title: string; totalMarks: number; passMark: number };
};

type ResultCategory = "all" | "exam" | "practice";
type SolutionCategory = "all" | "correct" | "incorrect" | "unanswered";
type ReportIssue =
  | "wrong-answer"
  | "unclear-question"
  | "option-problem"
  | "explanation-problem"
  | "other";

const reportIssues: Array<{ id: ReportIssue; label: string }> = [
  { id: "wrong-answer", label: "সঠিক উত্তর নিয়ে সমস্যা" },
  { id: "unclear-question", label: "প্রশ্নটি অস্পষ্ট" },
  { id: "option-problem", label: "অপশনে সমস্যা" },
  { id: "explanation-problem", label: "ব্যাখ্যায় সমস্যা" },
  { id: "other", label: "অন্যান্য" },
];

const optionLabels = ["ক", "খ", "গ", "ঘ"];
const emptyResults: McqResultStudent[] = [];

function formatDuration(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${banglaNumber(hours)} ঘণ্টা ${banglaNumber(minutes)} মিনিট`;
  if (minutes > 0) return `${banglaNumber(minutes)} মিনিট ${banglaNumber(remainingSeconds)} সেকেন্ড`;
  return `${banglaNumber(remainingSeconds)} সেকেন্ড`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function banglaNumber(value: number) {
  return new Intl.NumberFormat("bn-BD").format(value);
}

export function ResultHistory() {
  const { data, message, isLoading } = useApiQuery<{ results: McqResultStudent[] }>(
    "/api/mcq/results",
    {
      loadingMessage: "ফলাফল লোড হচ্ছে...",
      errorMessage: "ফলাফল লোড করা যায়নি। আবার চেষ্টা করুন।",
    },
  );
  const results = data?.results ?? emptyResults;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [resultCategory, setResultCategory] = useState<ResultCategory>("all");
  const [solutionCategory, setSolutionCategory] = useState<SolutionCategory>("all");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);
  const [solutions, setSolutions] = useState<SolutionDetail[]>([]);
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null);
  const [reportIssue, setReportIssue] = useState<ReportIssue>("wrong-answer");
  const [reportComment, setReportComment] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedQuestionIds, setReportedQuestionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedAttemptId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedAttemptId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedAttemptId]);

  const subjects = useMemo(
    () => Array.from(new Set(results.map((result) => result.subject).filter(Boolean))) as string[],
    [results],
  );

  const filteredResults = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("bn-BD");
    return results.filter((result) => {
      if (resultCategory === "exam" && result.isPractice) return false;
      if (resultCategory === "practice" && !result.isPractice) return false;
      if (selectedSubject !== "all" && result.subject !== selectedSubject) return false;
      if (!search) return true;
      const title = result.exam?.title || "MCQ Practice";
      return `${title} ${result.subject || ""}`.toLocaleLowerCase("bn-BD").includes(search);
    });
  }, [resultCategory, results, searchTerm, selectedSubject]);

  const summary = useMemo(() => {
    const total = results.length;
    const passed = results.filter((result) => result.isPassed).length;
    const average = total
      ? Math.round(results.reduce((sum, result) => sum + (result.percentage || 0), 0) / total)
      : 0;
    return {
      total,
      average,
      passRate: total ? Math.round((passed / total) * 100) : 0,
      totalTime: results.reduce((sum, result) => sum + (result.timeTaken || 0), 0),
    };
  }, [results]);

  const solutionSummary = useMemo(
    () => ({
      all: solutions.length,
      correct: solutions.filter((solution) => solution.isCorrect).length,
      incorrect: solutions.filter((solution) => !solution.isCorrect && solution.selectedIndex !== null).length,
      unanswered: solutions.filter((solution) => solution.selectedIndex === null).length,
    }),
    [solutions],
  );

  const filteredSolutions = useMemo(() => {
    if (solutionCategory === "correct") return solutions.filter((solution) => solution.isCorrect);
    if (solutionCategory === "incorrect") {
      return solutions.filter((solution) => !solution.isCorrect && solution.selectedIndex !== null);
    }
    if (solutionCategory === "unanswered") {
      return solutions.filter((solution) => solution.selectedIndex === null);
    }
    return solutions;
  }, [solutionCategory, solutions]);

  function resetReportForm() {
    setReportingQuestionId(null);
    setReportIssue("wrong-answer");
    setReportComment("");
    setReportError("");
  }

  function closeDetails() {
    setSelectedAttemptId(null);
    setSolutionCategory("all");
    resetReportForm();
  }

  async function openDetails(attemptId: string) {
    setSelectedAttemptId(attemptId);
    setDetailLoading(true);
    setDetailError("");
    setAttemptDetail(null);
    setSolutions([]);
    setSolutionCategory("all");
    resetReportForm();
    try {
      const { ok, payload } = await apiFetch<{ attempt: AttemptDetail; solutions: SolutionDetail[] }>(
        `/api/mcq/results/${attemptId}`,
      );
      if (ok && isApiSuccess(payload)) {
        setAttemptDetail(payload.data.attempt);
        setSolutions(payload.data.solutions);
      } else {
        setDetailError(getApiErrorMessage(payload, "উত্তরপত্র লোড করা যায়নি।"));
      }
    } catch {
      setDetailError("ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitReport(questionId: string) {
    if (!selectedAttemptId || reportComment.trim().length < 3 || reportSubmitting) return;
    setReportSubmitting(true);
    setReportError("");
    try {
      const { ok, payload } = await apiFetch("/api/mcq/results/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: selectedAttemptId,
          questionId,
          issueType: reportIssue,
          comment: reportComment.trim(),
        }),
      });
      if (ok && isApiSuccess(payload)) {
        setReportedQuestionIds((current) => new Set(current).add(questionId));
        resetReportForm();
      } else {
        setReportError(getApiErrorMessage(payload, "রিপোর্ট জমা দেওয়া যায়নি।"));
      }
    } catch {
      setReportError("ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
    } finally {
      setReportSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5" aria-label="ফলাফল লোড হচ্ছে">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-secondary/60" />)}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-secondary/40" />
      </div>
    );
  }

  if (message) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">{message}</div>;
  }

  if (!results.length) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpenCheck className="size-7" /></span>
        <h2 className="mt-4 text-xl font-extrabold text-primary">এখনো কোনো ফলাফল নেই</h2>
        <p className="mt-2 text-sm leading-6 text-muted">একটি MCQ Practice বা Exam সম্পন্ন করার পর ফলাফল, উত্তরপত্র ও ব্যাখ্যা এখানে দেখা যাবে।</p>
      </div>
    );
  }

  const summaryCards = [
    { label: "গড় Accuracy", value: `${banglaNumber(summary.average)}%`, icon: Target, tone: "bg-blue-50 text-blue-700" },
    { label: "Pass Rate", value: `${banglaNumber(summary.passRate)}%`, icon: Trophy, tone: "bg-amber-50 text-amber-700" },
    { label: "সম্পন্ন MCQ", value: banglaNumber(summary.total), icon: BookOpenCheck, tone: "bg-violet-50 text-violet-700" },
    { label: "মোট সময়", value: formatDuration(summary.totalTime), icon: Clock3, tone: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="ফলাফলের সারসংক্ষেপ">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="flex min-h-28 items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone)}><Icon className="size-5" /></span>
            <div className="min-w-0"><p className="text-xs font-bold text-muted">{label}</p><p className="mt-1 break-words text-xl font-black leading-tight text-primary">{value}</p></div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="ফলাফল খোঁজা ও ফিল্টার">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full gap-1 rounded-xl bg-secondary/50 p-1 sm:w-auto">
            {([
              { id: "all", label: "সব ফলাফল" },
              { id: "exam", label: "Exam" },
              { id: "practice", label: "Practice" },
            ] as const).map((item) => (
              <button key={item.id} type="button" onClick={() => setResultCategory(item.id)} className={cn("min-h-10 flex-1 rounded-lg px-3 text-sm font-bold transition sm:flex-none", resultCategory === item.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-card hover:text-primary")}>{item.label}</button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:w-[34rem]">
            <label className="relative flex-1">
              <span className="sr-only">ফলাফল খুঁজুন</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="বিষয় বা পরীক্ষার নাম খুঁজুন" className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30" />
            </label>
            <label className="relative sm:w-48">
              <span className="sr-only">বিষয় নির্বাচন করুন</span>
              <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-border bg-surface px-3 pr-9 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30">
                <option value="all">সব বিষয়</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            </label>
          </div>
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Lightbulb className="size-4.5" /></span>
        <div><p className="text-sm font-extrabold text-primary">ফলাফল বিশ্লেষণ করে পরবর্তী প্রস্তুতি ঠিক করুন</p><p className="mt-1 text-sm leading-6 text-muted">উত্তরপত্রে আপনার উত্তর, সঠিক উত্তর ও সহজ ব্যাখ্যা পাশাপাশি দেখানো হয়েছে। কোনো ভুল তথ্য চোখে পড়লে প্রশ্নটি রিপোর্ট করতে পারবেন।</p></div>
      </aside>

      {filteredResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><Search className="mx-auto size-7 text-muted" /><p className="mt-3 font-bold text-primary">মিলে যায় এমন ফলাফল পাওয়া যায়নি</p><p className="mt-1 text-sm text-muted">খোঁজার শব্দ বা নির্বাচিত বিষয় পরিবর্তন করে আবার দেখুন।</p></div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2" aria-label="ফলাফলের তালিকা">
          {filteredResults.map((result) => {
            const score = result.percentage || 0;
            const status = result.isCancelled ? "বাতিল" : result.isPassed ? "উত্তীর্ণ" : "অনুত্তীর্ণ";
            const statusTone = result.isCancelled ? "border-red-200 bg-red-50 text-red-700" : result.isPassed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-orange-700";
            return (
              <article key={result._id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/25 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-extrabold text-primary">{result.isPractice ? "MCQ Practice" : "নির্ধারিত Exam"}</span><span className={cn("rounded-full border px-2.5 py-1 text-xs font-extrabold", statusTone)}>{status}</span></div>
                    <h2 className="mt-3 text-lg font-black leading-7 text-primary">{result.exam?.title || "MCQ Practice"}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted">{result.subject && <span>{result.subject}</span>}<span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatDate(result.submittedAt)}</span></div>
                  </div>
                  <div className={cn("grid size-20 shrink-0 place-items-center rounded-2xl border", statusTone)}><div className="text-center"><p className="text-2xl font-black leading-none">{banglaNumber(score)}%</p><p className="mt-1 text-[11px] font-bold">Accuracy</p></div></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-secondary/35 p-3">
                  <div><p className="text-xs font-semibold text-muted">Score</p><p className="mt-1 text-base font-black text-primary">{banglaNumber(result.score)} / {result.exam?.totalMarks ? banglaNumber(result.exam.totalMarks) : "—"}</p></div>
                  <div><p className="text-xs font-semibold text-muted">সময়</p><p className="mt-1 text-base font-black text-primary">{formatDuration(result.timeTaken)}</p></div>
                </div>
                {result.teacherComment && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5"><p className="flex items-center gap-2 text-xs font-extrabold text-amber-800"><MessageSquareText className="size-4" /> শিক্ষকের মন্তব্য</p><p className="mt-2 text-sm leading-6 text-amber-950">{result.teacherComment}</p></div>}
                <Button type="button" onClick={() => openDetails(result._id)} className="mt-5 min-h-11 w-full rounded-xl font-bold"><Eye className="size-4" /> উত্তরপত্র ও ব্যাখ্যা দেখুন</Button>
              </article>
            );
          })}
        </section>
      )}

      {selectedAttemptId && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 p-0 backdrop-blur-sm sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="result-review-title" className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-surface shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-3xl sm:border sm:border-border">
            <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><p className="text-xs font-extrabold text-accent">উত্তরপত্র বিশ্লেষণ</p><h2 id="result-review-title" className="mt-1 text-lg font-black leading-7 text-primary sm:text-xl">{attemptDetail?.exam.title || "ফলাফলের বিস্তারিত লোড হচ্ছে..."}</h2></div>
                <button type="button" onClick={closeDetails} className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:bg-secondary hover:text-primary" aria-label="উত্তরপত্র বন্ধ করুন"><X className="size-5" /></button>
              </div>
              {attemptDetail && <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">{[["Score", `${banglaNumber(attemptDetail.score)} / ${banglaNumber(attemptDetail.exam.totalMarks)}`], ["Accuracy", `${banglaNumber(attemptDetail.percentage)}%`], ["সময়", formatDuration(attemptDetail.timeTaken)]].map(([label, value]) => <div key={label} className="rounded-xl bg-secondary/50 p-2.5 text-center"><p className="text-[11px] font-bold text-muted">{label}</p><p className="mt-1 text-sm font-black text-primary">{value}</p></div>)}</div>}
            </header>

            {!detailLoading && !detailError && solutions.length > 0 && (
              <nav className="shrink-0 overflow-x-auto border-b border-border bg-card px-4 py-3 sm:px-6" aria-label="উত্তরের ধরন অনুযায়ী বাছাই">
                <div className="flex min-w-max gap-2">{([{ id: "all", label: "সব প্রশ্ন" }, { id: "correct", label: "সঠিক" }, { id: "incorrect", label: "ভুল" }, { id: "unanswered", label: "উত্তর দেওয়া হয়নি" }] as const).map((item) => <button key={item.id} type="button" onClick={() => setSolutionCategory(item.id)} className={cn("min-h-10 rounded-xl border px-3 text-sm font-bold transition", solutionCategory === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted hover:text-primary")}>{item.label} <span className="ml-1 opacity-75">({banglaNumber(solutionSummary[item.id])})</span></button>)}</div>
              </nav>
            )}

            <div className="flex-1 overflow-y-auto bg-secondary/20 px-3 py-5 sm:px-6">
              {detailLoading && <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted"><RefreshCw className="size-8 animate-spin text-primary" /><p className="text-sm font-semibold">উত্তরপত্র প্রস্তুত হচ্ছে...</p></div>}
              {detailError && <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-center"><AlertCircle className="mx-auto size-7 text-red-600" /><p className="mt-3 text-sm font-semibold leading-6 text-red-700">{detailError}</p></div>}
              {!detailLoading && !detailError && filteredSolutions.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm font-semibold text-muted">এই বিভাগে কোনো প্রশ্ন নেই।</div>}
              {!detailLoading && !detailError && filteredSolutions.length > 0 && (
                <div className="mx-auto max-w-3xl space-y-5">
                  {filteredSolutions.map((solution) => {
                    const questionNumber = solutions.findIndex((item) => item.id === solution.id) + 1;
                    const answered = solution.selectedIndex !== null;
                    const statusLabel = !answered ? "উত্তর দেওয়া হয়নি" : solution.isCorrect ? "সঠিক উত্তর" : "ভুল উত্তর";
                    const statusClass = !answered ? "bg-amber-50 text-amber-800 border-amber-200" : solution.isCorrect ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200";
                    return (
                      <article key={solution.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                        <div className="border-b border-border px-4 py-4 sm:px-5"><div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground">{banglaNumber(questionNumber)}</span><div className="min-w-0 flex-1"><span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", statusClass)}>{statusLabel}</span><h3 className="mt-3 text-base font-bold leading-7 text-primary sm:text-lg">{solution.question}</h3></div></div></div>
                        <div className="space-y-3 px-4 py-4 sm:px-5">
                          <p className="text-xs font-extrabold text-muted">অপশনসমূহ</p>
                          <div className="grid gap-2.5">
                            {solution.options.map((option, optionIndex) => {
                              const correct = optionIndex === solution.correctIndex;
                              const selected = optionIndex === solution.selectedIndex;
                              return <div key={`${solution.id}-${optionIndex}`} className={cn("flex min-h-12 items-start justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm leading-6", correct ? "border-emerald-300 bg-emerald-50 text-emerald-950" : selected ? "border-red-300 bg-red-50 text-red-950" : "border-border bg-surface text-primary")}><span className="flex gap-2.5"><strong className="shrink-0">{optionLabels[optionIndex]}.</strong><span>{option}</span></span><span className="flex shrink-0 flex-col items-end gap-1 text-xs font-bold">{correct && <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="size-4" /> সঠিক</span>}{selected && !correct && <span className="inline-flex items-center gap-1 text-red-700"><XCircle className="size-4" /> আপনার উত্তর</span>}{selected && correct && <span className="text-emerald-700">আপনার উত্তর</span>}</span></div>;
                            })}
                          </div>

                          <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/65 p-4 sm:p-5" aria-label="সমাধানের ব্যাখ্যা">
                            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Lightbulb className="size-4.5" /></span><div><h4 className="text-sm font-extrabold text-primary">সমাধানের ব্যাখ্যা</h4><p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700 sm:text-base sm:leading-8">{solution.explanation || "এই প্রশ্নের জন্য আলাদা ব্যাখ্যা যোগ করা হয়নি। সঠিক অপশনটি উপরে সবুজ রঙে চিহ্নিত করা হয়েছে।"}</p></div></div>
                          </section>

                          {reportedQuestionIds.has(solution.id) ? (
                            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="size-4.5" /> রিপোর্টটি জমা হয়েছে। শিক্ষক এটি পর্যালোচনা করবেন।</div>
                          ) : reportingQuestionId === solution.id ? (
                            <section className="rounded-2xl border border-amber-200 bg-amber-50/55 p-4" aria-label="প্রশ্ন রিপোর্ট করার ফর্ম">
                              <div className="flex items-start justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-extrabold text-primary"><Flag className="size-4 text-amber-700" /> প্রশ্নে সমস্যা রিপোর্ট করুন</h4><p className="mt-1 text-xs leading-5 text-muted">কী ধরনের সমস্যা দেখেছেন তা নির্বাচন করে সংক্ষেপে লিখুন।</p></div><button type="button" onClick={resetReportForm} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-white hover:text-primary" aria-label="রিপোর্ট ফর্ম বন্ধ করুন"><X className="size-4" /></button></div>
                              <div className="mt-4 flex flex-wrap gap-2">{reportIssues.map((issue) => <button key={issue.id} type="button" onClick={() => setReportIssue(issue.id)} className={cn("min-h-9 rounded-full border px-3 text-xs font-bold transition", reportIssue === issue.id ? "border-amber-700 bg-amber-700 text-white" : "border-amber-200 bg-white text-amber-900 hover:border-amber-400")}>{issue.label}</button>)}</div>
                              <label className="mt-4 block"><span className="text-xs font-bold text-primary">সমস্যার সংক্ষিপ্ত বিবরণ</span><textarea value={reportComment} onChange={(event) => setReportComment(event.target.value)} rows={3} maxLength={500} placeholder="যেমন: সঠিক উত্তরটি বইয়ের তথ্যের সঙ্গে মিলছে না..." className="mt-2 w-full resize-y rounded-xl border border-amber-200 bg-white px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-200" /></label>
                              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted"><span className={reportError ? "font-bold text-red-700" : ""}>{reportError || "ব্যক্তিগত তথ্য লিখবেন না।"}</span><span>{banglaNumber(reportComment.length)}/৫০০</span></div>
                              <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={resetReportForm} disabled={reportSubmitting} className="rounded-xl">বাতিল</Button><Button type="button" onClick={() => submitReport(solution.id)} loading={reportSubmitting} disabled={reportSubmitting || reportComment.trim().length < 3} className="rounded-xl">রিপোর্ট জমা দিন</Button></div>
                            </section>
                          ) : (
                            <button type="button" onClick={() => { resetReportForm(); setReportingQuestionId(solution.id); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-muted transition hover:bg-amber-50 hover:px-3 hover:text-amber-800"><Flag className="size-4" /> এই প্রশ্নে সমস্যা রিপোর্ট করুন</button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
            <footer className="flex shrink-0 items-center justify-end border-t border-border bg-card px-4 py-3 sm:px-6"><Button type="button" onClick={closeDetails} className="rounded-xl">উত্তরপত্র বন্ধ করুন</Button></footer>
          </section>
        </div>
      )}
    </div>
  );
}
