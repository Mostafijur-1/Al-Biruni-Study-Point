"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { createLocalizedPath } from "@/lib/i18n";
import { McqOption, getOptionLabel } from "@/components/exam/McqOption";
import { cn } from "@/lib/utils";

type ExamData = {
  _id: string;
  title: string;
  duration: number; // in minutes
  totalMarks: number;
  passMark: number;
  questionCount: number;
};

type ExamQuestion = {
  id: string;
  question: string;
  options: string[];
};

type ExamTimerProps = {
  durationSeconds: number;
  onTimeUp: () => void;
};

/**
 * Isolated timer component that handles its own 1-second ticks.
 * Prevents re-rendering the parent MCQ Runner list every second.
 */
const ExamTimer = React.memo(
  function ExamTimer({ durationSeconds, onTimeUp }: ExamTimerProps) {
    const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
    const onTimeUpRef = useRef(onTimeUp);

    useEffect(() => {
      onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    useEffect(() => {
      if (secondsLeft <= 0) {
        onTimeUpRef.current();
        return;
      }

      const interval = window.setInterval(() => {
        setSecondsLeft((current) => Math.max(0, current - 1));
      }, 1000);

      return () => window.clearInterval(interval);
    }, [secondsLeft]);

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    const isLowTime = secondsLeft <= 60;

    return (
      <div
        className={cn(
          "shrink-0 rounded-xl border-2 px-4 py-3 text-center",
          isLowTime ? "border-brand-red bg-red-50" : "border-primary/20 bg-secondary"
        )}
      >
        <p className="text-xs font-semibold uppercase text-muted">Time left</p>
        <p
          className={cn(
            "font-display text-2xl font-bold tabular-nums",
            isLowTime ? "text-brand-red" : "text-primary"
          )}
        >
          {minutes}:{seconds}
        </p>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.durationSeconds === nextProps.durationSeconds
);

type ExamQuestionCardProps = {
  question: ExamQuestion;
  index: number;
  selectedIndex: number | undefined;
  disabled?: boolean;
  onSelectOption: (questionId: string, optionIndex: number) => void;
};

/**
 * Memoized question card rendering options.
 * Only re-renders when the selectedIndex or disabled state updates.
 */
const ExamQuestionCard = React.memo(function ExamQuestionCard({
  question,
  index,
  selectedIndex,
  disabled,
  onSelectOption,
}: ExamQuestionCardProps) {
  const isAnswered = selectedIndex !== undefined;

  return (
    <article
      className={cn(
        "rounded-xl border-2 bg-card p-4 shadow-[var(--shadow-sm)] transition-colors sm:p-5",
        isAnswered ? "border-primary/25" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3 flex-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="pt-0.5 text-base font-bold leading-snug text-foreground sm:text-lg">
              {question.question}
            </h2>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
          1 mark
        </span>
      </div>

      <div className="mt-4 grid gap-2.5 sm:gap-3">
        {question.options.map((option, optionIndex) => (
          <McqOption
            key={`${question.id}-${optionIndex}`}
            label={getOptionLabel(optionIndex)}
            optionText={option}
            isSelected={selectedIndex === optionIndex}
            disabled={disabled}
            onSelect={() => !disabled && onSelectOption(question.id, optionIndex)}
          />
        ))}
      </div>
    </article>
  );
});

type McqExamRunnerProps = {
  examId: string;
  };

export function McqExamRunner({ examId }: McqExamRunnerProps) {
  const locale = "bn";
      const router = useRouter();
  
  const [phase, setPhase] = useState<"instructions" | "loading" | "running" | "submitting" | "completed">("instructions");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [isOffline, setIsOffline] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);
  const [wasAutoSubmittedDueToTabLeave, setWasAutoSubmittedDueToTabLeave] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // New UI/UX modal states
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Refs for event listeners to avoid dependency array recreation overhead
  const answersRef = useRef(answers);
  const phaseRef = useRef(phase);
  const examRef = useRef(exam);
  const startTimeRef = useRef(startTime);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  // Handle mounting & online/offline checking
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load Exam Data on mount
  useEffect(() => {
    const loadExam = async () => {
      try {
        setPhase("loading");
        const { ok, payload } = await apiFetch<{ exam: ExamData; questions: ExamQuestion[] }>(
          `/api/mcq/exams/${examId}/start`
        );
        if (ok && isApiSuccess(payload)) {
          setExam(payload.data.exam);
          setQuestions(payload.data.questions);

          // Restore saved progress from localStorage if exists
          let loadedAnswers: Record<string, number> = {};
          const storageKey = `absp_exam_${examId}`;
          try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              const validQuestionIds = new Set(payload.data.questions.map((q) => q.id));
              Object.keys(parsed).forEach((key) => {
                if (validQuestionIds.has(key)) {
                  loadedAnswers[key] = parsed[key];
                }
              });
            }
          } catch (e) {
            console.error("Failed to restore exam progress:", e);
          }
          setAnswers(loadedAnswers);
          setPhase("instructions");
        } else {
          setErrorMessage(getApiErrorMessage(payload, "Failed to initialize exam."));
        }
      } catch {
        setErrorMessage("Connection error loading exam.");
      }
    };
    loadExam();
  }, [examId]);

  // Auto-save answers progress to localStorage during active exam
  useEffect(() => {
    if (phase !== "running" || !isMounted) return;
    const storageKey = `absp_exam_${examId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch (e) {
      console.error("Failed to auto-save exam answers:", e);
    }
  }, [answers, phase, examId, isMounted]);

  // Handle option select
  const handleSelectOption = useCallback((questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  }, []);

  // Submit Exam API call
  const submitExam = useCallback(async (timeTakenSec: number, currentAnswers: Record<string, number>) => {
    if (phaseRef.current === "submitting" || phaseRef.current === "completed") return;
    setPhase("submitting");

    try {
      const formattedAnswers = questions.map((q) => ({
        questionId: q.id,
        selectedIndex: currentAnswers[q.id] !== undefined ? currentAnswers[q.id] : null,
      }));

      const { ok, payload } = await apiFetch(`/api/mcq/exams/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: formattedAnswers,
          timeTaken: timeTakenSec,
        }),
      });

      if (ok && isApiSuccess(payload)) {
        // Clear saved progress from localStorage on success
        try {
          localStorage.removeItem(`absp_exam_${examId}`);
        } catch (e) {
          console.error("Failed to clear exam progress:", e);
        }
        setPhase("completed");
      } else {
        setSubmitError(getApiErrorMessage(payload, "Submission failed. Please try again."));
        setPhase("running");
      }
    } catch {
      setSubmitError("Network error submitting exam. Please check your connection.");
      setPhase("running");
    }
  }, [examId, questions]);

  // Handle manual submit click
  const handleSubmitClick = () => {
    setShowSubmitConfirm(true);
  };

  // Handle time up trigger
  const handleTimeUp = useCallback(() => {
    setIsTimeUp(true);
    const totalSeconds = examRef.current ? examRef.current.duration * 60 : 0;
    submitExam(totalSeconds, answersRef.current);
  }, [submitExam]);

  // Event listeners for page leave prevention & tab switching
  useEffect(() => {
    if (phase !== "running") return;

    // 1. Alert user on browser close/reload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    // 2. Auto-submit on window blur or tab change (visibility loss)
    const handleTabLeave = () => {
      setWasAutoSubmittedDueToTabLeave(true);
      const totalSeconds = examRef.current ? examRef.current.duration * 60 : 0;
      const elapsedSeconds = startTimeRef.current
        ? Math.min(totalSeconds, Math.round((Date.now() - startTimeRef.current) / 1000))
        : totalSeconds;
      submitExam(elapsedSeconds, answersRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleTabLeave();
      }
    };

    // 3. Intercept Next.js / HTML link clicks
    const handleAnchorClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (target && target.tagName === "A") {
        const href = (target as HTMLAnchorElement).getAttribute("href");
        if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
          e.preventDefault();
          e.stopPropagation();

          setPendingNavigationUrl((target as HTMLAnchorElement).href);
          setShowLeaveWarning(true);
        }
      }
    };

    // 4. Intercept browser back/forward buttons
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setPendingNavigationUrl("/student/exams");
      setShowLeaveWarning(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("blur", handleTabLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("blur", handleTabLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [phase, submitExam]);

  // Scroll to top when phase changes
  useEffect(() => {
    if (phase === "running" || phase === "completed") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [phase]);

  // UI state rendering
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <RefreshCw className="size-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted">
          {"পরীক্ষা লোড হচ্ছে..."}
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-4">
        <AlertTriangle className="size-12 text-brand-red mx-auto" />
        <h2 className="text-lg font-bold text-red-800">
          {"ত্রুটি ঘটেছে"}
        </h2>
        <p className="text-sm text-red-700">{errorMessage}</p>
        <Button onClick={() => router.push("/student/exams")} className="rounded-xl font-bold">
          {"পরীক্ষা তালিকায় ফিরে যান"}
        </Button>
      </div>
    );
  }

  if (!exam) return null;

  // 1. Instructions Phase
  if (phase === "instructions") {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-md)] space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            {"পরীক্ষার বিবরণ"}
          </p>
          <h1 className="font-display mt-2 text-2xl font-bold text-primary md:text-3xl leading-tight">
            {exam.title}
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-secondary/50 border border-border/40 p-4 text-center">
            <Clock className="size-6 text-primary mx-auto mb-1.5" />
            <span className="block text-2xs text-muted font-bold uppercase">
              {"সময়সীমা"}
            </span>
            <span className="text-base font-bold text-primary">
              {exam.duration} {"মিনিট"}
            </span>
          </div>

          <div className="rounded-xl bg-secondary/50 border border-border/40 p-4 text-center">
            <Award className="size-6 text-brand-yellow mx-auto mb-1.5" />
            <span className="block text-2xs text-muted font-bold uppercase">
              {"মোট নম্বর"}
            </span>
            <span className="text-base font-bold text-primary">{exam.totalMarks}</span>
          </div>

          <div className="rounded-xl bg-secondary/50 border border-border/40 p-4 text-center">
            <BookOpen className="size-6 text-brand-blue mx-auto mb-1.5" />
            <span className="block text-2xs text-muted font-bold uppercase">
              {"পাস নম্বর"}
            </span>
            <span className="text-base font-bold text-primary">{exam.passMark}</span>
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-3.5">
          <h3 className="font-bold text-primary text-sm">
            {"গুরুত্বপূর্ণ নির্দেশনাবলী:"}
          </h3>
          <ul className="text-xs text-muted space-y-2.5 list-disc pl-5 font-semibold leading-relaxed">
            <li>
              {"পরীক্ষা চলাকালীন পেজ রিফ্রেশ বা ব্যাক করবেন না।"}
            </li>
            <li>
              {"সময় শেষ হয়ে গেলে পরীক্ষাটি স্বয়ংক্রিয়ভাবে সাবমিট হবে।"}
            </li>
            <li>
              {"প্রতিটি প্রশ্নের জন্য ১ নম্বর বরাদ্দ রয়েছে এবং কোনো নেগেটিভ মার্ক নেই।"}
            </li>
            <li>
              {"পরীক্ষার ফলাফল এবং সঠিক উত্তর আপনার শিক্ষক পরবর্তীতে প্রকাশ করবেন।"}
            </li>
          </ul>
        </div>

        <div className="flex justify-end gap-3 pt-5 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => router.push("/student/exams")}
            className="rounded-xl font-bold"
          >
            {"বাতিল"}
          </Button>
          <Button
            onClick={() => {
              setStartTime(Date.now());
              setPhase("running");
            }}
            className="rounded-xl font-bold flex items-center gap-1.5 px-6"
          >
            <Play className="size-3.5 fill-current" />
            {"পরীক্ষা শুরু করুন"}
          </Button>
        </div>
      </div>
    );
  }

  // 2. Running Exam Phase
  if (phase === "running" || phase === "submitting") {
    const answeredCount = Object.keys(answers).length;
    const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

    return (
      <section className="space-y-5">
        {/* Offline Banner */}
        {isOffline && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm flex items-start gap-3 animate-in fade-in duration-300">
            <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">
                {"আপনি এখন অফলাইন আছেন"}
              </h3>
              <p className="text-xs leading-5 text-red-700">
                {"আপনার ইন্টারনেট কানেকশন বিচ্ছিন্ন রয়েছে। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ বা বন্ধ করবেন না। আপনার উত্তরগুলো আপনার ব্রাউজারে সুরক্ষিত রয়েছে এবং ইন্টারনেট ফিরে আসলে সাবমিট করতে পারবেন।"}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Exam Mode
              </span>
              <h1 className="mt-1.5 font-display text-2xl font-bold text-primary sm:text-3xl">
                {exam.title}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {answeredCount}/{questions.length} answered · total marks {exam.totalMarks} · pass mark {exam.passMark}
              </p>
            </div>
            <ExamTimer durationSeconds={exam.duration * 60} onTimeUp={handleTimeUp} />
          </div>

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
        </div>

        {/* Questions list */}
        <div className="space-y-4">
          {questions.map((question, index) => {
            const selectedIndex = answers[question.id];

            return (
              <ExamQuestionCard
                key={question.id}
                question={question}
                index={index}
                selectedIndex={selectedIndex}
                disabled={phase === "submitting" || isTimeUp}
                onSelectOption={handleSelectOption}
              />
            );
          })}
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full rounded-xl"
          onClick={handleSubmitClick}
          loading={phase === "submitting"}
        >
          {phase === "submitting"
            ? "Submitting..."
            : locale === "bn"
            ? `পরীক্ষা জমা দিন (${answeredCount}/${questions.length}টি উত্তর দেওয়া হয়েছে)`
            : `Submit Exam (${answeredCount}/${questions.length} answered)`}
        </Button>

        {/* --- CUSTOM SUBMIT CONFIRMATION MODAL --- */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                  <CheckCircle2 className="size-6 text-primary" />
                </div>
                <div className="space-y-4 w-full">
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-primary">
                      {"পরীক্ষা জমা দিতে চান?"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {"জমা দেওয়ার পূর্বে আপনার উত্তরগুলো মিলিয়ে নিন।"}
                    </p>
                  </div>

                  {/* Visual Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        {"উত্তর দেওয়া হয়েছে"}
                      </span>
                      <span className="text-xl font-extrabold text-emerald-700">{answeredCount}</span>
                    </div>
                    <div
                      className={cn(
                        "rounded-xl border p-3 text-center",
                        questions.length - answeredCount > 0
                          ? "border-red-100 bg-red-50/50"
                          : "border-emerald-100 bg-emerald-50/50"
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[10px] font-bold uppercase tracking-wider",
                          questions.length - answeredCount > 0 ? "text-brand-red" : "text-emerald-800"
                        )}
                      >
                        {"বাকি আছে"}
                      </span>
                      <span
                        className={cn(
                          "text-xl font-extrabold",
                          questions.length - answeredCount > 0 ? "text-brand-red" : "text-emerald-700"
                        )}
                      >
                        {questions.length - answeredCount}
                      </span>
                    </div>
                  </div>

                  {/* Alert for unanswered questions */}
                  {questions.length - answeredCount > 0 && (
                    <div className="rounded-xl border border-red-200/50 bg-red-50/80 p-3 text-left flex gap-2 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertTriangle className="size-4 text-brand-red shrink-0 mt-0.5" />
                      <p className="text-[11px] text-red-800 leading-normal font-semibold">
                        {"সতর্কতা: বাকি থাকা প্রশ্নগুলোর জন্য কোনো নম্বর পাওয়া যাবে না।"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex flex-col sm:flex-row items-center gap-3 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl py-2.5 font-bold"
                    onClick={() => setShowSubmitConfirm(false)}
                  >
                    {"ফিরে যান"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full rounded-xl py-2.5 font-bold"
                    onClick={() => {
                      setShowSubmitConfirm(false);
                      const totalSeconds = exam ? exam.duration * 60 : 0;
                      const elapsedSeconds = startTimeRef.current
                        ? Math.min(totalSeconds, Math.round((Date.now() - startTimeRef.current) / 1000))
                        : totalSeconds;
                      submitExam(elapsedSeconds, answers);
                    }}
                  >
                    {"জমা দিন"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- CUSTOM SUBMIT ERROR MODAL --- */}
        {submitError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="size-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shrink-0">
                  <AlertTriangle className="size-6 text-brand-red animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-bold text-primary">
                    {"সাবমিশন ব্যর্থ হয়েছে"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {submitError}
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full rounded-xl py-2.5 font-bold"
                  onClick={() => setSubmitError(null)}
                >
                  {"ঠিক আছে"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --- CUSTOM LEAVE WARNING MODAL --- */}
        {showLeaveWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="size-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shrink-0">
                  <AlertTriangle className="size-6 text-brand-red animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-bold text-primary">
                    {"পরীক্ষা চলমান আছে!"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {"পরীক্ষা চলাকালীন আপনি অন্য পৃষ্ঠায় যেতে পারবেন না। অনুগ্রহ করে প্রথমে আপনার পরীক্ষাটি সাবমিট করুন।"}
                  </p>
                </div>
                <div className="mt-2 flex flex-col sm:flex-row items-center gap-3 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl py-2.5 font-bold"
                    onClick={() => {
                      setShowLeaveWarning(false);
                      setPendingNavigationUrl(null);
                    }}
                  >
                    {"পরীক্ষায় ফিরে যান"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full rounded-xl py-2.5 font-bold bg-brand-red text-white hover:bg-brand-red/90"
                    onClick={async () => {
                      setShowLeaveWarning(false);
                      const totalSeconds = exam ? exam.duration * 60 : 0;
                      const elapsedSeconds = startTimeRef.current
                        ? Math.min(totalSeconds, Math.round((Date.now() - startTimeRef.current) / 1000))
                        : totalSeconds;
                      await submitExam(elapsedSeconds, answersRef.current);
                      if (pendingNavigationUrl) {
                        window.location.href = pendingNavigationUrl;
                      } else {
                        window.location.href = "/student/exams";
                      }
                    }}
                  >
                    {"সাবমিট করে চলে যান"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // 3. Completed Phase
  if (phase === "completed") {
    return (
      <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-6 md:p-8 text-center shadow-[var(--shadow-md)] space-y-5">
        {wasAutoSubmittedDueToTabLeave ? (
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm flex items-start gap-3 animate-in fade-in duration-300 text-left mb-2">
            <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">
                {"স্বয়ংক্রিয়ভাবে সাবমিট করা হয়েছে"}
              </h3>
              <p className="text-xs leading-5 text-red-700">
                {"পরীক্ষা চলাকালীন উইন্ডো বা ট্যাব পরিবর্তন করার কারণে আপনার পরীক্ষাটি স্বয়ংক্রিয়ভাবে সাবমিট করা হয়েছে।"}
              </p>
            </div>
          </div>
        ) : (
          <div className="size-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="size-10" />
          </div>
        )}

        <h2 className="font-display text-xl font-bold text-primary">
          {"পরীক্ষা সফলভাবে সম্পন্ন হয়েছে!"}
        </h2>
        <p className="text-xs text-muted leading-relaxed font-semibold">
          {"আপনার পরীক্ষার উত্তরগুলো সফলভাবে জমা নেওয়া হয়েছে। আপনার শিক্ষক ফলাফল মূল্যায়ন করার পরে তা প্রকাশ করবেন।"}
        </p>
        <div className="pt-4 border-t border-border">
          <Button
            onClick={() => router.push("/student/exams")}
            className="w-full rounded-xl py-2.5 font-bold"
          >
            {"পরীক্ষা তালিকায় ফিরে যান"}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
