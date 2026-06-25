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
  Search,
  Filter,
  Trophy,
  Percent,
  Sparkles,
  HelpCircle,
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

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [categoryTab, setCategoryTab] = useState<"all" | "exams" | "practice">("all");
  const [solutionsTab, setSolutionsTab] = useState<"all" | "correct" | "incorrect" | "unanswered">("all");

  const handleOpenSolutions = async (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setModalLoading(true);
    setModalError("");
    setAttemptDetail(null);
    setSolutions([]);
    setSolutionsTab("all");

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
      <div className="rounded-2xl border border-border bg-surface p-6 text-center text-muted font-semibold">
        {message}
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted font-bold flex flex-col items-center justify-center gap-4 max-w-md mx-auto mt-6 shadow-[var(--shadow-sm)]">
        <div className="size-14 rounded-2xl bg-secondary/40 text-primary flex items-center justify-center shrink-0">
          <BookOpen className="size-7 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-primary">No results found</h3>
          <p className="text-xs text-muted mt-1 font-semibold leading-relaxed">
            You haven't completed any MCQ exams or practice sessions yet. Once you complete a test, your results will appear here!
          </p>
        </div>
      </div>
    );
  }

  // Dashboard Stats Calculations
  const totalTests = results.length;
  const examAttemptsCount = results.filter((r) => !r.isPractice).length;
  const practiceAttemptsCount = results.filter((r) => r.isPractice).length;

  const passedTests = results.filter((r) => r.isPassed).length;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  const averageScore =
    totalTests > 0
      ? Math.round(results.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalTests)
      : 0;

  const totalTimeSeconds = results.reduce((acc, curr) => acc + (curr.timeTaken || 0), 0);
  const formattedTime = (() => {
    const hrs = Math.floor(totalTimeSeconds / 3600);
    const mins = Math.floor((totalTimeSeconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${totalTimeSeconds % 60}s`;
  })();

  // Unique Subjects for dropdown
  const subjects = Array.from(
    new Set(results.map((r: any) => r.subject).filter(Boolean))
  ) as string[];

  // Filter Logic
  const filteredResults = results.filter((result: any) => {
    // 1. Category Tab
    if (categoryTab === "exams" && result.isPractice) return false;
    if (categoryTab === "practice" && !result.isPractice) return false;

    // 2. Subject Dropdown
    if (selectedSubject !== "all" && result.subject !== selectedSubject) return false;

    // 3. Search input
    if (searchTerm.trim() !== "") {
      const search = searchTerm.toLowerCase();
      const title = (result.exam?.title || "Practice Session").toLowerCase();
      const sub = (result.subject || "").toLowerCase();
      if (!title.includes(search) && !sub.includes(search)) return false;
    }

    return true;
  });

  // Modal Solution Filters
  const modalTotal = solutions.length;
  const modalCorrect = solutions.filter((s) => s.isCorrect).length;
  const modalIncorrect = solutions.filter((s) => !s.isCorrect && s.selectedIndex !== null).length;
  const modalUnanswered = solutions.filter((s) => s.selectedIndex === null).length;

  const filteredSolutions = solutions.filter((sol) => {
    if (solutionsTab === "correct") return sol.isCorrect;
    if (solutionsTab === "incorrect") return !sol.isCorrect && sol.selectedIndex !== null;
    if (solutionsTab === "unanswered") return sol.selectedIndex === null;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Dashboard Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Accuracy */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5 relative overflow-hidden group hover:border-brand-blue/30 transition duration-200">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <div className="size-11 rounded-xl bg-brand-blue-light text-brand-blue flex items-center justify-center shrink-0">
            <Percent className="size-5.5" strokeWidth={2.5} />
          </div>
          <div>
            <span className="block text-3xs font-extrabold text-muted uppercase tracking-wider">Average Accuracy</span>
            <span className="text-lg md:text-xl font-black text-primary leading-tight">{averageScore}%</span>
          </div>
        </div>

        {/* Pass Rate */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5 relative overflow-hidden group hover:border-accent/40 transition duration-200">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <div className="size-11 rounded-xl bg-accent/15 text-accent-foreground flex items-center justify-center shrink-0">
            <Trophy className="size-5.5 text-brand-yellow" strokeWidth={2.5} />
          </div>
          <div>
            <span className="block text-3xs font-extrabold text-muted uppercase tracking-wider">Pass Rate</span>
            <span className="text-lg md:text-xl font-black text-primary leading-tight">{passRate}%</span>
          </div>
        </div>

        {/* Tests Completed */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5 relative overflow-hidden group hover:border-purple-200 transition duration-200">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <div className="size-11 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center shrink-0">
            <BookOpen className="size-5.5" strokeWidth={2.5} />
          </div>
          <div>
            <span className="block text-3xs font-extrabold text-muted uppercase tracking-wider">Total Completed</span>
            <span className="text-lg md:text-xl font-black text-primary leading-tight">{totalTests}</span>
            <span className="block text-4xs font-bold text-muted mt-0.5">
              {examAttemptsCount} E | {practiceAttemptsCount} P
            </span>
          </div>
        </div>

        {/* Time Spent */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5 relative overflow-hidden group hover:border-emerald-200 transition duration-200">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <div className="size-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Clock className="size-5.5" strokeWidth={2.5} />
          </div>
          <div>
            <span className="block text-3xs font-extrabold text-muted uppercase tracking-wider">Practice Time</span>
            <span className="text-lg md:text-xl font-black text-primary leading-tight">{formattedTime}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-border shadow-[var(--shadow-sm)]">
        {/* Tabs */}
        <div className="flex bg-secondary/35 p-1 rounded-xl border border-border/30 shrink-0">
          {(["all", "exams", "practice"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setCategoryTab(tab)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer",
                categoryTab === tab
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:text-primary"
              )}
            >
              {tab === "all" ? "All" : tab === "exams" ? "Exams" : "Practice"}
            </button>
          ))}
        </div>

        {/* Search & Subject Selectors */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1 md:max-w-md">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted/80" />
            <input
              type="text"
              placeholder="Search results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-surface text-xs font-semibold placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {/* Subject Dropdown */}
          <div className="relative shrink-0 sm:w-44">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-10 pl-3 pr-8 rounded-xl border border-border bg-surface text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="all">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {filteredResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted font-bold flex flex-col items-center justify-center gap-3">
          <Sparkles className="size-8 text-brand-blue opacity-50 animate-pulse" />
          <div>
            <p className="text-xs text-primary font-bold">No matching results found</p>
            <p className="text-3xs text-muted mt-1 font-semibold">
              Try adjusting your search query, changing the selected subject, or selecting a different tab.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredResults.map((result: any) => {
            const isPractice = result.isPractice ?? false;
            const scorePercent = result.percentage || 0;
            return (
              <article
                key={result._id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-primary/20 transition duration-200 relative overflow-hidden",
                  result.isCancelled 
                    ? "border-l-4 border-l-red-500 bg-red-50/10" 
                    : result.isPassed 
                    ? "border-l-4 border-l-emerald-500 bg-emerald-50/10" 
                    : "border-l-4 border-l-orange-500 bg-orange-50/10"
                )}
              >
                <div className="space-y-4">
                  {/* Badge & Date Row */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-2xs font-extrabold uppercase tracking-wider",
                        isPractice
                          ? "bg-secondary text-primary border border-primary/10"
                          : "bg-purple-50 text-purple-800 border border-purple-100"
                      )}
                    >
                      {isPractice ? "Practice Test" : "Official Exam"}
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

                  {/* Title & Subject */}
                  <div>
                    <h2 className="font-display text-base font-bold text-primary leading-snug line-clamp-1">
                      {result.exam?.title || "Practice Session"}
                    </h2>
                    {result.subject && (
                      <span className="inline-block mt-1.5 text-3xs font-extrabold uppercase tracking-wide text-muted bg-secondary/40 px-2 py-0.5 rounded">
                        {result.subject}
                      </span>
                    )}
                  </div>

                  {/* Core Stats Block */}
                  <div className="space-y-3 bg-surface/70 p-3 rounded-xl border border-border/40">
                    <div className="flex items-center justify-between text-2xs font-bold text-muted">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Award className="size-3.5 text-brand-yellow" />
                        Score: {result.score}/{result.exam?.totalMarks || "-"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" />
                        Time: {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s
                      </span>
                    </div>

                    {/* Score accuracy progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-muted">
                        <span>Accuracy</span>
                        <span className={result.isCancelled ? "text-red-500" : result.isPassed ? "text-emerald-600" : "text-orange-500"}>
                          {scorePercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${scorePercent}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            result.isCancelled ? "bg-red-500" : result.isPassed ? "bg-emerald-500" : "bg-orange-500"
                          )}
                        />
                      </div>
                    </div>

                    {/* Passed/Failed Badging */}
                    <div className="flex items-center gap-1.5 text-2xs font-bold mt-1">
                      <CheckCircle2
                        className={cn(
                          "size-3.5 shrink-0",
                          result.isCancelled ? "text-red-500" : result.isPassed ? "text-emerald-500" : "text-orange-500"
                        )}
                      />
                      <span>
                        Status:{" "}
                        <strong className={result.isCancelled ? "text-red-600 font-bold" : result.isPassed ? "text-emerald-700" : "text-orange-600 font-bold"}>
                          {result.isCancelled ? "Cancelled" : result.isPassed ? "Passed" : "Failed"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Teacher Feedback Block */}
                  {result.teacherComment && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-1 relative">
                      <span className="text-3xs font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <MessageSquare className="size-3 text-amber-700" />
                        Feedback from {result.commentedBy?.name || "Teacher"}
                      </span>
                      <p className="text-xs text-amber-900 font-medium italic">
                        "{result.teacherComment}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Card CTA */}
                <div className="mt-5">
                  {!isPractice ? (
                    <Button
                      onClick={() => handleOpenSolutions(result._id)}
                      variant="outline"
                      className="w-full rounded-xl py-2 text-xs font-bold border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 flex items-center justify-center gap-1 hover:scale-[1.01] active:scale-[0.99] transition duration-150"
                    >
                      <Eye className="size-3.5" />
                      View Answers & Explanations
                    </Button>
                  ) : (
                    <div className="text-center py-2 text-3xs font-bold text-muted uppercase tracking-wider bg-secondary/20 border border-border/30 rounded-xl">
                      Detailed explanations hidden for practice
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Solutions Review Modal */}
      {selectedAttemptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col justify-between animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 pb-3.5">
              <div>
                <span className="text-3xs font-extrabold uppercase tracking-wider text-muted">
                  Reviewing Solutions
                </span>
                <h3 className="font-display text-base md:text-lg font-bold text-primary leading-tight mt-0.5">
                  {attemptDetail ? attemptDetail.exam.title : "Loading Exam Details..."}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedAttemptId(null);
                  setSolutionsTab("all");
                }}
                className="text-muted hover:text-primary transition font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Subheader / Static Stats (Non-scrolling) */}
            {attemptDetail && (
              <div className="py-3.5 border-b border-border/40 space-y-3.5">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2.5 text-3xs font-bold text-muted">
                  <div className="bg-secondary/40 border border-border/40 rounded-lg p-2 text-center">
                    <span className="block uppercase tracking-wider text-muted mb-0.5">Score</span>
                    <span className="text-sm font-black text-primary font-display">
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

                {/* Solutions Category Filters */}
                {!modalLoading && !modalError && solutions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 bg-secondary/20 p-1 rounded-xl border border-border/30">
                    {[
                      { id: "all", label: "All Questions", count: modalTotal },
                      { id: "correct", label: "Correct", count: modalCorrect, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                      { id: "incorrect", label: "Incorrect", count: modalIncorrect, color: "text-brand-red bg-red-50 border-red-100" },
                      { id: "unanswered", label: "Unanswered", count: modalUnanswered, color: "text-amber-600 bg-amber-50 border-amber-100" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSolutionsTab(item.id as any)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-3xs font-extrabold rounded-lg transition-all border border-transparent cursor-pointer",
                          solutionsTab === item.id
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted hover:text-primary hover:bg-secondary/50"
                        )}
                      >
                        <span>{item.label}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-full text-[9px] font-black border",
                            solutionsTab === item.id
                              ? "bg-white/20 text-white border-transparent"
                              : item.color || "bg-secondary text-primary border-border"
                          )}
                        >
                          {item.count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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

              {/* Solutions List mapping */}
              {!modalLoading && !modalError && filteredSolutions.length > 0 && (
                <div className="space-y-4">
                  {filteredSolutions.map((sol) => {
                    const originalIdx = solutions.findIndex((s) => s.id === sol.id);
                    const hasAnswered = sol.selectedIndex !== null;
                    const isCorrect = sol.isCorrect;

                    return (
                      <article
                        key={sol.id}
                        className={cn(
                          "rounded-xl border p-4 space-y-3 transition duration-150",
                          !hasAnswered
                            ? "border-amber-100 bg-amber-50/10 border-l-4 border-l-amber-500"
                            : isCorrect
                              ? "border-emerald-100 bg-emerald-50/5 border-l-4 border-l-emerald-500"
                              : "border-red-100 bg-red-50/5 border-l-4 border-l-brand-red"
                        )}
                      >
                        {/* Question Text */}
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded text-3xs font-extrabold text-white mt-0.5 shadow-xs",
                              !hasAnswered
                                ? "bg-amber-500"
                                : isCorrect
                                  ? "bg-emerald-600"
                                  : "bg-brand-red"
                            )}
                          >
                            {originalIdx + 1}
                          </span>
                          <div className="flex-1">
                            <h4 className="text-xs md:text-sm font-bold text-primary leading-snug">
                              {sol.question}
                            </h4>
                            {!hasAnswered && (
                              <span className="inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800 uppercase tracking-wider mt-1.5">
                                Unanswered
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Options */}
                        <div className="grid gap-2 pl-8 text-xs font-semibold">
                          {sol.options.map((opt, optIdx) => {
                            const isCorrectOpt = optIdx === sol.correctIndex;
                            const isStudentOpt = optIdx === sol.selectedIndex;

                            return (
                              <div
                                key={optIdx}
                                className={cn(
                                  "flex items-center justify-between rounded-lg border p-2.5 transition duration-100",
                                  isCorrectOpt
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-950 font-bold"
                                    : isStudentOpt
                                      ? "border-brand-red/35 bg-red-50 text-red-950"
                                      : "border-border bg-secondary/10 text-muted/80"
                                )}
                              >
                                <span>
                                  {String.fromCharCode(65 + optIdx)}. {opt}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isCorrectOpt && (
                                    <span className="rounded-full bg-emerald-600 p-0.5 text-white shadow-xs">
                                      <Check className="size-3" strokeWidth={3} />
                                    </span>
                                  )}
                                  {isStudentOpt && !isCorrectOpt && (
                                    <span className="rounded-full bg-brand-red p-0.5 text-white shadow-xs">
                                      <X className="size-3" strokeWidth={3} />
                                    </span>
                                  )}
                                  {isStudentOpt && (
                                    <span className="text-3xs font-extrabold uppercase tracking-wider px-1 text-primary opacity-60">
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
                          <div className="mt-2.5 rounded-lg border border-border/40 bg-secondary/15 p-3 text-3xs md:text-2xs text-muted leading-relaxed font-semibold pl-8 flex items-start gap-2">
                            <HelpCircle className="size-3.5 text-brand-blue shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-primary font-bold">Explanation:</strong>{" "}
                              {sol.explanation}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Modal Filtered Empty State */}
              {!modalLoading && !modalError && filteredSolutions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-muted font-bold flex flex-col items-center justify-center gap-3">
                  <Sparkles className="size-8 text-brand-blue opacity-50" />
                  <div>
                    <p className="text-xs text-primary font-bold">No questions found</p>
                    <p className="text-3xs text-muted mt-1 font-semibold">
                      No questions match the current filter tab.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border/80 pt-3.5 flex justify-end">
              <Button
                onClick={() => {
                  setSelectedAttemptId(null);
                  setSolutionsTab("all");
                }}
                className="rounded-xl font-bold cursor-pointer"
              >
                Close Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
