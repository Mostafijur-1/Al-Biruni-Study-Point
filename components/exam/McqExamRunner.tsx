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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
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
    const endTimeRef = useRef(0);

    useEffect(() => {
      onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    useEffect(() => {
      endTimeRef.current = Date.now() + durationSeconds * 1000;
      const interval = window.setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 0) return 0;
          const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
          if (remaining <= 0) {
            onTimeUpRef.current();
          }
          return remaining;
        });
      }, 1000);

      return () => window.clearInterval(interval);
    }, [durationSeconds]);

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

  const [phase, setPhase] = useState<"instructions" | "loading" | "running" | "submitting" | "completed">("loading");
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

  // Countdown and tab switching warning states
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [loadingDone, setLoadingDone] = useState(false);
  const [, setTabSwitchCount] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const tabSwitchCountRef = useRef(0);
  const isAwayRef = useRef(false);

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
    const timer = window.setTimeout(() => {
      setIsMounted(true);
      setIsOffline(!window.navigator.onLine);
    }, 0);
    return () => window.clearTimeout(timer);
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

  // Countdown timer for starting exam
  useEffect(() => {
    if (phase !== "loading") return;
    if (countdownSeconds <= 0) {
      if (loadingDone) {
        const timer = window.setTimeout(() => setPhase("instructions"), 0);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    const timer = setTimeout(() => {
      setCountdownSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, countdownSeconds, loadingDone]);

  // Load Exam Data on mount
  useEffect(() => {
    const loadExam = async () => {
      try {
        const { ok, payload } = await apiFetch<{ exam: ExamData; questions: ExamQuestion[] }>(
          `/api/mcq/exams/${examId}/start`
        );
        if (ok && isApiSuccess(payload)) {
          setExam(payload.data.exam);
          setQuestions(payload.data.questions);

          // Restore saved progress from localStorage if exists
          const loadedAnswers: Record<string, number> = {};
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
          setLoadingDone(true);
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
  const submitExam = useCallback(async (timeTakenSec: number, currentAnswers: Record<string, number>, isCancelled = false) => {
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
          isCancelled,
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
      if (phaseRef.current !== "running" || isAwayRef.current) return;
      isAwayRef.current = true;

      tabSwitchCountRef.current += 1;
      setTabSwitchCount(tabSwitchCountRef.current);

      if (tabSwitchCountRef.current >= 2) {
        setWasAutoSubmittedDueToTabLeave(true);
        const totalSeconds = examRef.current ? examRef.current.duration * 60 : 0;
        const elapsedSeconds = startTimeRef.current
          ? Math.min(totalSeconds, Math.round((Date.now() - startTimeRef.current) / 1000))
          : totalSeconds;
        submitExam(elapsedSeconds, answersRef.current, true);
      }
    };

    const handleTabReturn = () => {
      if (phaseRef.current !== "running" || !isAwayRef.current) return;
      isAwayRef.current = false;

      if (tabSwitchCountRef.current === 1) {
        setShowTabSwitchWarning(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleTabLeave();
      } else if (document.visibilityState === "visible") {
        handleTabReturn();
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
    window.addEventListener("focus", handleTabReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("blur", handleTabLeave);
      window.removeEventListener("focus", handleTabReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [phase, submitExam]);

  // Scroll to top when phase changes
  useEffect(() => {
    if (phase === "loading" || phase === "running" || phase === "completed") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [phase]);

  // Auto-retry submission if locked out and reconnects
  useEffect(() => {
    if (!isOffline && wasAutoSubmittedDueToTabLeave && phase === "running" && submitError) {
      const timer = window.setTimeout(() => {
        setSubmitError(null);
        const totalSeconds = examRef.current ? examRef.current.duration * 60 : 0;
        const elapsedSeconds = startTimeRef.current
          ? Math.min(totalSeconds, Math.round((Date.now() - startTimeRef.current) / 1000))
          : totalSeconds;
        void submitExam(elapsedSeconds, answersRef.current, true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOffline, wasAutoSubmittedDueToTabLeave, phase, submitError, submitExam]);

  // UI state rendering
  if (phase === "loading") {
    return (
      <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-md)] flex flex-col items-center justify-center space-y-6 py-16 animate-in fade-in duration-300">
        <div className="relative flex items-center justify-center size-24">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          <div className="size-20 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center bg-background shadow-inner">
            <span className="font-display text-4xl font-black text-primary animate-in zoom-in duration-200">
              {countdownSeconds > 0 ? countdownSeconds : "✓"}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold text-primary">
            {countdownSeconds > 0 ? "আপনার পরীক্ষা শুরু হচ্ছে" : "পরীক্ষা প্রস্তুত"}
          </h2>
          <p className="text-xs text-muted font-semibold leading-relaxed">
            {countdownSeconds > 0 
              ? `${countdownSeconds} সেকেন্ডের মধ্যে পরীক্ষা শুরু হতে যাচ্ছে...` 
              : "পরীক্ষার প্রশ্ন লোড করা সম্পন্ন হয়েছে।"}
          </p>
        </div>
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
            {"গুরুত্বपूर्ण নির্দেশনাবলী:"}
          </h3>
          <ul className="text-xs text-muted space-y-2.5 list-disc pl-5 font-semibold leading-relaxed">
            <li className="text-brand-red font-bold">
              {"পরীক্ষা চলাকালীন উইন্ডো বা ট্যাব পরিবর্তন করবেন না। একাধিকবার পরিবর্তন করলে আপনার পরীক্ষাটি স্বয়ংক্রিয়ভাবে বাতিল হয়ে যাবে।"}
            </li>
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
        {isOffline && !wasAutoSubmittedDueToTabLeave && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm flex items-start gap-3 animate-in fade-in duration-300">
            <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">
                {"আপনি এখন অফলাইন আছেন"}
              </h3>
              <p className="text-xs leading-5 text-red-700">
                {"আপনার internet connection বিচ্ছিন্ন রয়েছে। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ বা বন্ধ করবেন পরীক্ষটি আপনার ব্রাউজারে সুরক্ষিত রয়েছে এবং ইন্টারনেট ফিরে আসলে সাবমিট করতে পারবেন।"}
              </p>
            </div>
          </div>
        )}

        {/* Locked Banner */}
        {wasAutoSubmittedDueToTabLeave && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm flex items-start gap-3 animate-in fade-in duration-300">
            <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">
                {"পরীক্ষা বাতিল করা হয়েছে"}
              </h3>
              <p className="text-xs leading-5 text-red-700">
                {isOffline 
                  ? "আপনি একাধিকবার ট্যাব পরিবর্তন করেছেন, তাই আপনার পরীক্ষা বাতিল করা হয়েছে। ইন্টারনেট সংযোগ ফিরে এলে এটি স্বয়ংক্রিয়ভাবে সাবমিট হবে।" 
                  : "আপনি একাধিকবার ট্যাব পরিবর্তন করেছেন, তাই আপনার পরীক্ষা বাতিল করে সাবমিট করা হচ্ছে..."}
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
                disabled={phase === "submitting" || isTimeUp || wasAutoSubmittedDueToTabLeave}
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
          disabled={wasAutoSubmittedDueToTabLeave}
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
                      submitExam(elapsedSeconds, answers, false);
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
                      await submitExam(elapsedSeconds, answersRef.current, false);
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

        {/* --- TAB SWITCHING WARNING MODAL --- */}
        {showTabSwitchWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="size-12 rounded-full bg-yellow-50 flex items-center justify-center border border-yellow-100 shrink-0">
                  <AlertTriangle className="size-6 text-brand-yellow animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-bold text-primary">
                    {"ট্যাব পরিবর্তনের সতর্কতা!"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-semibold text-red-600">
                    {"আপনি উইন্ডো বা ট্যাব পরিবর্তন করেছেন! পরীক্ষা চলাকালীন পুনরায় ট্যাব বা উইন্ডো পরিবর্তন করলে আপনার পরীক্ষাটি বাতিল এবং স্বয়ংক্রিয়ভাবে সাবমিট হয়ে যাবে।"}
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full rounded-xl py-2.5 font-bold"
                  onClick={() => setShowTabSwitchWarning(false)}
                >
                  {"পরীক্ষায় ফিরে যান"}
                </Button>
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
          <div className="rounded-xl border border-brand-red bg-red-50/90 p-5 shadow-sm flex items-start gap-3 animate-in fade-in duration-300 text-left mb-2">
            <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">
                {"পরীক্ষা বাতিল করা হয়েছে"}
              </h3>
              <p className="text-xs leading-5 text-red-700 font-semibold">
                {"পরীক্ষা চলাকালীন একাধিকবার ট্যাব বা উইন্ডো পরিবর্তন করার কারণে আপনার পরীক্ষাটি বাতিল করা হয়েছে এবং উত্তরগুলো স্বয়ংক্রিয়ভাবে সাবমিট করা হয়েছে।"}
              </p>
            </div>
          </div>
        ) : (
          <div className="size-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="size-10" />
          </div>
        )}

        <h2 className="font-display text-xl font-bold text-primary">
          {wasAutoSubmittedDueToTabLeave ? "পরীক্ষা সম্পন্ন করা যায়নি" : "পরীক্ষা সফলভাবে সম্পন্ন হয়েছে!"}
        </h2>
        <p className="text-xs text-muted leading-relaxed font-semibold">
          {wasAutoSubmittedDueToTabLeave 
            ? "নীতিমালা লঙ্ঘন করার কারণে আপনার পরীক্ষা বাতিল হয়েছে। আপনার বর্তমান উত্তরগুলো আপনার শিক্ষকের নিকট পাঠানো হয়েছে।"
            : "আপনার পরীক্ষার উত্তরগুলো সফলভাবে জমা নেওয়া হয়েছে। আপনার শিক্ষক ফলাফল মূল্যায়ন করার পরে তা প্রকাশ করবেন।"}
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
