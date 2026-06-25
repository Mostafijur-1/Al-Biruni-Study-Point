"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, Brain, CheckCircle2 } from "lucide-react";
import type { CourseSubject } from "@/types";

import { useRouter } from "next/navigation";
import { guestLevelQuery, useGuestLevel } from "@/lib/hooks/use-guest-level";
import { useSession } from "@/lib/hooks/use-session";
import { useAppStore } from "@/stores/useAppStore";
import { getOptionLabel, McqOption } from "@/components/exam/McqOption";
import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { createLocalizedPath, getLocalizedPath, type Locale } from "@/lib/i18n";
import { getTranslatedChapter, SYLLABUS, getSchoolLevel } from "@/lib/content/syllabus";
import { cn } from "@/lib/utils";

type ChapterStatus = {
  subject: string;
  chapters: Array<{ name: string; hasMcqs: boolean }>;
  lastResult: {
    score: number;
    totalQuestions: number;
    percentage: number;
    isPassed: boolean;
    submittedAt: string;
  } | null;
};

type PracticeQuestion = {
  id: string;
  question: string;
  options: string[];
  imageUrl?: string;
};

type PracticeSubmitResult = {
  result: {
    score: number;
    totalQuestions: number;
    percentage: number;
    isPassed: boolean;
    timeTaken: number;
    submittedAt: string;
  };
  totalQuestions: number;
  solutions: {
    questionId: string;
    correctIndex: number;
    explanation?: string;
  }[];
};

type McqPracticeRunnerProps = {
  subject: string;
  locale?: string;
  mode?: string;
};

function getOptionResultMode(
  optionIndex: number,
  selectedIndex: number | undefined,
  correctIndex: number | undefined,
  hasResult: boolean
): "idle" | "correct" | "wrong" | "missed-correct" | "unchanged" {
  if (!hasResult || correctIndex === undefined) {
    return "idle";
  }

  if (optionIndex === correctIndex) {
    return selectedIndex === correctIndex ? "correct" : "missed-correct";
  }

  if (selectedIndex === optionIndex) {
    return "wrong";
  }

  return "unchanged";
}

type PracticeTimerProps = {
  durationSeconds: number;
  onTimeUp: () => void;
};

/**
 * Isolated timer component that handles its own 1-second ticks.
 * Prevents re-rendering the parent MCQ Runner list every second.
 */
const PracticeTimer = React.memo(
  function PracticeTimer({ durationSeconds, onTimeUp }: PracticeTimerProps) {
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

type PracticeQuestionCardProps = {
  question: PracticeQuestion;
  index: number;
  selectedIndex: number | undefined;
  disabled?: boolean;
  onSelectOption: (questionId: string, optionIndex: number) => void;
};

/**
 * Memoized question card rendering options.
 * Only re-renders when the selectedIndex or disabled state updates.
 */
const PracticeQuestionCard = React.memo(function PracticeQuestionCard({
  question,
  index,
  selectedIndex,
  disabled,
  onSelectOption,
}: PracticeQuestionCardProps) {
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
            {question.imageUrl && (
              <img
                src={question.imageUrl}
                alt="Question illustration"
                className="mt-3 max-w-full max-h-64 w-auto rounded-lg object-contain border border-border/60 bg-muted/20"
              />
            )}
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

type ChapterListItemProps = {
  chapter: string;
  index: number;
  isChecked: boolean;
  isDisabled: boolean;
  displayName: string;
  locale: string;
  onToggle: (chapterName: string) => void;
};

/**
 * Memoized list item for chapter selection.
 * Prevents full chapter list redraws and font flickering on checkbox toggle.
 */
const ChapterListItem = React.memo(function ChapterListItem({
  chapter,
  index,
  isChecked,
  isDisabled,
  displayName,
  locale,
  onToggle,
}: ChapterListItemProps) {
  const inputId = `chapter-${chapter.replace(/[^a-z0-9]+/gi, "-")}-${index}`;

  return (
    <li className="w-full">
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors h-full w-full",
          isDisabled
            ? "border-border/40 opacity-60 cursor-not-allowed bg-secondary/10"
            : isChecked
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-card hover:border-primary/20 hover:bg-secondary/40",
        )}
      >
        <div className="flex items-center h-5">
          <input
            id={inputId}
            type="checkbox"
            checked={isChecked}
            disabled={isDisabled}
            onChange={() => onToggle(chapter)}
            className="size-4 shrink-0 rounded border-border text-primary focus:ring-primary disabled:opacity-50 cursor-pointer"
          />
        </div>
        <label
          htmlFor={isDisabled ? undefined : inputId}
          className={cn(
            "min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 select-none",
            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          <span
            className={cn(
              "text-sm leading-tight transition-colors",
              isChecked ? "font-semibold text-primary" : "text-foreground",
            )}
          >
            {displayName}
          </span>
          {isDisabled && (
            <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50 uppercase tracking-tight">
              {locale === "bn" ? "শীঘ্রই আসছে" : "Coming soon"}
            </span>
          )}
        </label>
      </div>
    </li>
  );
});

export function McqPracticeRunner({ subject, mode = "general" }: McqPracticeRunnerProps) {
  const locale = "bn";
  const path = createLocalizedPath(locale);
  const router = useRouter();
  const { user, checking } = useSession({ listenToAuthChanges: true });
  const isGuest = !user;
  const level = useGuestLevel();
  const practiceListHref = path(`/student/practice${isGuest ? guestLevelQuery(level) : ""}`);

  // States
  const { practiceStatusCache, setPracticeStatusCache } = useAppStore();
  const [phase, setPhase] = useState<"configuring" | "loading" | "running" | "result">("configuring");
  const [availableChapters, setAvailableChapters] = useState<Array<{ name: string; hasMcqs: boolean }>>([]);
  
  // Countdown and tab switching warning states
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [loadingDone, setLoadingDone] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const tabSwitchCountRef = useRef(0);
  const isAwayRef = useRef(false);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(0);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState<number>(45);
  const [passMarkPercent, setPassMarkPercent] = useState<number>(60);
  const [result, setResult] = useState<PracticeSubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number>(25);
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null);
  const [reportComment, setReportComment] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);
  const [wasAutoSubmittedDueToTabLeave, setWasAutoSubmittedDueToTabLeave] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);
    }
  }, []);

  // Monitor network connection status
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

  // Auto-save answers progress to localStorage during active practice
  useEffect(() => {
    if (phase !== "running" || !isMounted) return;
    const storageKey = user ? `absp_practice_${user.id}_${subject}_${mode}` : `absp_practice_guest_${subject}_${mode}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch (e) {
      console.error("Failed to auto-save practice answers:", e);
    }
  }, [answers, phase, user, subject, isMounted, mode]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  // Load subject status and chapters
  useEffect(() => {
    if (checking) return;

    const cacheKey = `practice_status_${mode}_${isGuest ? level : "user"}`;
    const cachedData = practiceStatusCache[cacheKey];
    const cachedList = Array.isArray(cachedData) ? cachedData : cachedData?.status;
    const cachedSettings = Array.isArray(cachedData) ? null : cachedData?.settings;
    const matchingSubject = cachedList?.find((s: any) => s.subject === subject);

    if (matchingSubject && !configLoaded) {
      setAvailableChapters(matchingSubject.chapters);
      const enabledChapters = matchingSubject.chapters
        .filter((c: any) => c.hasMcqs)
        .map((c: any) => c.name);
      setSelectedChapters(enabledChapters);
      if (cachedSettings) {
        setSecondsPerQuestion(cachedSettings.secondsPerQuestion);
        setPassMarkPercent(cachedSettings.passMarkPercent);
      }
      setLoadingConfig(false);
      setConfigLoaded(true);
    }

    async function loadConfig() {
      try {
        if (!matchingSubject) {
          setLoadingConfig(true);
        }
        const url = isGuest
          ? `/api/mcq/practice/status?scope=guest&level=${level}&subject=${encodeURIComponent(subject)}`        
          : `/api/mcq/practice/status?subject=${encodeURIComponent(subject)}&mode=${mode}`;
        const { ok, payload } = await apiFetch<{
          status: ChapterStatus[];
          settings?: { secondsPerQuestion: number; passMarkPercent: number };
        }>(url);
        if (ok && isApiSuccess(payload)) {
          const matching = payload.data.status.find((s) => s.subject === subject);
          if (matching) {
            setAvailableChapters(matching.chapters);
            const enabledChapters = matching.chapters
              .filter((c) => c.hasMcqs)
              .map((c) => c.name);
            // Only overwrite selected chapters if they haven't been modified by user yet
            setSelectedChapters((prev) => prev.length === 0 ? enabledChapters : prev);
            if (payload.data.settings) {
              setSecondsPerQuestion(payload.data.settings.secondsPerQuestion);
              setPassMarkPercent(payload.data.settings.passMarkPercent);
            }
            setConfigLoaded(true);

            // Also update the global cache so the dashboard is kept fresh!
            if (cachedData) {
              const updatedList = cachedList.map((s: any) => s.subject === subject ? matching : s);
              const newCacheVal = Array.isArray(cachedData) ? updatedList : { ...cachedData, status: updatedList };
              setPracticeStatusCache(cacheKey, newCacheVal);
            }
          } else {
            if (!matchingSubject) {
              setErrorMessage("এই বিষয়ে কোন অধ্যায় পাওয়া যায়নি।");
            }
          }
        } else {
          if (!matchingSubject) {
            setErrorMessage(getApiErrorMessage(payload, "Could not load practice chapters."));
          }
        }
      } catch (error: any) {
        console.error("[Practice Load Config Catch Technical Details]:", error);
        if (!matchingSubject) {
          setErrorMessage("An unexpected error occurred while loading settings.");
        }
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, [subject, locale, checking, isGuest, level, mode, configLoaded, practiceStatusCache, setPracticeStatusCache]);

  // Toggle chapter selection
  const toggleChapter = useCallback((chapterName: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapterName)
        ? prev.filter((c) => c !== chapterName)
        : [...prev, chapterName]
    );
  }, []);

  // Toggle all chapters
  const toggleSelectAll = useCallback(() => {
    const enabledChapters = availableChapters.filter((c) => c.hasMcqs).map((c) => c.name);
    if (selectedChapters.length === enabledChapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(enabledChapters);
    }
  }, [availableChapters, selectedChapters]);

  // Countdown timer for starting practice
  useEffect(() => {
    if (phase !== "loading") return;
    if (countdownSeconds <= 0) {
      if (loadingDone) {
        setStartTime(Date.now());
        setPhase("running");
      }
      return;
    }
    const timer = setTimeout(() => {
      setCountdownSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, countdownSeconds, loadingDone]);

  // Start practice session
  const startPractice = useCallback(async () => {
    if (selectedChapters.length === 0) return;

    if (isGuest) {
      const nextPath = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.push(getLocalizedPath(`/login?next=${nextPath}&reason=access`));
      return;
    }

    setCountdownSeconds(3);
    setLoadingDone(false);
    tabSwitchCountRef.current = 0;
    setTabSwitchCount(0);
    setShowTabSwitchWarning(false);
    setPhase("loading");
    setErrorMessage("");

    try {
      const chaptersQuery = selectedChapters.map((c) => encodeURIComponent(c)).join(",");
      const { ok, payload } = await apiFetch<{
        questions: PracticeQuestion[];
        subject: string;
        durationSeconds: number;
        totalQuestions: number;
        secondsPerQuestion: number;
        passMarkPercent: number;
      }>(`/api/mcq/practice/start?subject=${encodeURIComponent(subject)}&chapters=${chaptersQuery}&limit=${selectedQuestionCount}&mode=${mode}`);

      if (!ok || !isApiSuccess(payload)) {
        setErrorMessage(getApiErrorMessage(payload, "Could not start practice exam."));
        setPhase("configuring");
        return;
      }

      const data = payload.data;
      setQuestions(data.questions);
      setTotalDurationSeconds(data.durationSeconds);
      setSecondsPerQuestion(data.secondsPerQuestion);
      setPassMarkPercent(data.passMarkPercent);
      // Try to restore saved answers from localStorage if any exist
      let loadedAnswers: Record<string, number> = {};
      const storageKey = user ? `absp_practice_${user.id}_${subject}_${mode}` : `absp_practice_guest_${subject}_${mode}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const validQuestionIds = new Set(data.questions.map((q) => q.id));
          Object.keys(parsed).forEach((key) => {
            if (validQuestionIds.has(key)) {
              loadedAnswers[key] = parsed[key];
            }
          });
        }
      } catch (e) {
        console.error("Failed to restore practice progress:", e);
      }

      setAnswers(loadedAnswers);
      setResult(null);
      setIsTimeUp(false);
      setLoadingDone(true);
    } catch (error: any) {
      console.error("[Start Practice Catch Technical Details]:", error);
      setErrorMessage("Could not connect to server to fetch practice questions.");
      setPhase("configuring");
    }
  }, [selectedChapters, isGuest, locale, router, subject, selectedQuestionCount, user, mode]);

  const handleSelectOption = useCallback((questionId: string, optionIndex: number) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionIndex,
    }));
  }, []);

  const buildSubmitAnswers = useCallback(() => {
    return questions.map((question) => ({
      questionId: question.id,
      selectedIndex: answers[question.id] ?? null,
    }));
  }, [questions, answers]);

  // Submit practice attempt
  const submitPractice = useCallback(async (isCancelled = false) => {
    if (isSubmitting || questions.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setSubmitError(null);

    const elapsedSeconds = startTime
      ? Math.min(totalDurationSeconds, Math.round((Date.now() - startTime) / 1000))
      : totalDurationSeconds;

    try {
      const { ok, payload } = await apiFetch<PracticeSubmitResult>(
        "/api/mcq/practice/submit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            timeTaken: elapsedSeconds,
            answers: buildSubmitAnswers(),
            mode,
            isCancelled,
          }),
        }
      );

      if (!ok || !isApiSuccess(payload)) {
        setSubmitError(getApiErrorMessage(payload, "Submission failed. Please try again."));
        setIsSubmitting(false);
        return;
      }

      // Clear saved progress from localStorage on success
      const storageKey = user ? `absp_practice_${user.id}_${subject}_${mode}` : `absp_practice_guest_${subject}_${mode}`;
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.error("Failed to clear practice progress:", e);
      }

      setResult(payload.data);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      console.error("[Submit Practice Catch Technical Details]:", error);
      setSubmitError(
        locale === "bn"
          ? "সাবমিট করা যায়নি। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।"
          : "Submission failed. Please check your internet connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [startTime, totalDurationSeconds, questions, buildSubmitAnswers, isSubmitting, subject, user, locale, mode]);

  const handleTimeUp = useCallback(() => {
    setIsTimeUp(true);
    submitPractice();
  }, [submitPractice]);

  // Scroll to top when phase changes to running or result
  useEffect(() => {
    if (phase === "running" || phase === "result") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [phase]);

  // Handle prevention of page navigation, window/tab switching, and reload/close in test mode
  useEffect(() => {
    if (phase !== "running") return;

    // 1. Alert user on browser close/reload (this uses standard browser UI and is required to prevent accidental closes)
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
        submitPractice(true); // Submit as cancelled!
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
        // Only intercept real page transitions (not anchor links or javascript voids)
        if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
          e.preventDefault();
          e.stopPropagation();

          setPendingNavigationUrl((target as HTMLAnchorElement).href);
          setShowLeaveWarning(true);
        }
      }
    };

    // 4. Intercept browser back/forward buttons
    // Push an initial state to the history stack so we can intercept popstate
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // Keep them on the current URL by pushing another state
      window.history.pushState(null, "", window.location.href);

      setPendingNavigationUrl(practiceListHref);
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
  }, [phase, locale, submitPractice, practiceListHref]);

  const handleSendReport = useCallback(async () => {
    if (!reportingQuestionId || !reportComment.trim() || isSubmittingReport) return;
    setIsSubmittingReport(true);
    setReportError("");
    setReportSuccess(false);
    try {
      const { ok, payload } = await apiFetch("/api/mcq/practice/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: reportingQuestionId,
          comment: reportComment.trim(),
        }),
      });
      if (ok && isApiSuccess(payload)) {
        setReportSuccess(true);
        setTimeout(() => {
          setReportingQuestionId(null);
          setReportComment("");
          setReportSuccess(false);
        }, 1500);
      } else {
        setReportError(getApiErrorMessage(payload, "Failed to submit report."));
      }
    } catch (error: any) {
      console.error("[Submit Question Report Catch Technical Details]:", error);
      setReportError("An error occurred while submitting report.");
    } finally {
      setIsSubmittingReport(false);
    }
  }, [reportingQuestionId, reportComment, isSubmittingReport]);

  // Display subject name (strip "1st Paper" / "2nd Paper" suffix for heading)
  const displaySubject = subject.replace(/ (1st|2nd) Paper$/, "");
  const paperLabel = subject !== displaySubject
    ? subject.match(/(1st|2nd) Paper$/)?.[0]
    : null;

  // UI Renderers
  if (!isMounted || loadingConfig) {
    return (
      <section className="space-y-4 animate-pulse">
        {/* Header Skeleton */}
        <div className="rounded-xl border border-border bg-card/40 p-4 shadow-[var(--shadow-sm)] sm:p-5">       
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-secondary" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-16 rounded bg-secondary" />
              <div className="h-6 w-1/3 rounded bg-secondary" />
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="overflow-hidden rounded-xl border border-border bg-card/40 shadow-[var(--shadow-sm)]">  
          {/* List Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/20 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 flex-1">
              <div className="size-4 rounded bg-secondary" />
              <div className="h-5 w-24 rounded bg-secondary" />
              <div className="h-5 w-10 rounded-full bg-secondary" />
            </div>
            <div className="h-4 w-16 rounded bg-secondary" />
          </div>

          {/* Chapters Grid Skeleton */}
          <div className="px-3 py-3 sm:px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 p-3 bg-secondary/10">
                  <div className="size-4 rounded bg-secondary shrink-0" />
                  <div className="h-4 w-2/3 rounded bg-secondary" />
                </div>
              ))}
            </div>
          </div>

          {/* Footer Bar */}
          <div className="border-t border-border bg-secondary/10 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-20 rounded bg-secondary" />
              ))}
            </div>
          </div>
        </div>

        {/* Start Button Skeleton */}
        <div className="h-11 w-full rounded-xl bg-secondary sm:w-48" />
      </section>
    );
  }

  // --- PHASE: CONFIGURING ---
  if (phase === "configuring") {
    const estQuestionCount = selectedQuestionCount;
    const estTotalSeconds = estQuestionCount * secondsPerQuestion;
    const estMinutes = Math.floor(estTotalSeconds / 60);
    const estSecondsRemainder = estTotalSeconds % 60;
    const enabledChapters = availableChapters.filter((c) => c.hasMcqs);
    const allSelected =
      enabledChapters.length > 0 &&
      selectedChapters.length === enabledChapters.length;

    return (
      <section 
        className="space-y-4"
        style={{
          animation: "fadeIn 0.35s ease-in-out forwards",
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}} />

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <div className="flex items-center gap-3">
            <Link
              href={practiceListHref}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:bg-secondary hover:text-primary"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Test Mode</p>
              <h1 className="font-display text-xl font-bold text-primary sm:text-2xl">
                {displaySubject} {paperLabel} MCQ Test
              </h1>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">     
          <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-primary" />
              <h2 className="truncate font-semibold text-primary">
                {locale === "bn" ? "অধ্যায় সিলেক্ট করো" : "Select chapters"}
              </h2>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary"> 
                {selectedChapters.length}/{availableChapters.length}
              </span>
              {!configLoaded && (
                <div className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
              )}
            </div>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="shrink-0 text-xs font-bold text-primary underline underline-offset-2 hover:opacity-80" 
            >
              {allSelected
                ? locale === "bn"
                  ? "সব আনসিলেক্ট করো"
                  : "Clear all"
                : locale === "bn"
                  ? "সব সিলেক্ট করো"
                  : "Select all"}
            </button>
          </div>

          <div className="px-3 py-3 sm:px-4">
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
              {availableChapters.map((chapInfo, index) => {
                const chapter = chapInfo.name;
                const isChecked = selectedChapters.includes(chapter);
                const displayName = getTranslatedChapter(chapter, locale);
                const isDisabled = !chapInfo.hasMcqs;

                return (
                  <ChapterListItem
                    key={chapter}
                    chapter={chapter}
                    index={index}
                    isChecked={isChecked}
                    isDisabled={isDisabled}
                    displayName={displayName}
                    locale={locale}
                    onToggle={toggleChapter}
                  />
                );
              })}
            </ul>
          </div>

          <div className="border-t border-border bg-secondary/20 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "অধ্যায়" : "Chapters"}:{" "}
                <strong className="text-primary">{selectedChapters.length}</strong>
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "সময়/প্রশ্ন" : "Per question"}:{" "}
                <strong className="text-primary">{secondsPerQuestion}s</strong>
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "পাস মার্ক" : "Pass mark"}:{" "}
                <strong className="text-primary">{passMarkPercent}%</strong>
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "আনুমানিক সময়" : "Est. time"}:{" "}
                <strong className="text-primary">
                  {locale === "bn" ? (
                    <>
                      {estMinutes > 0 ? `${estMinutes} মিনিট` : ""} {estSecondsRemainder > 0 ? `${estSecondsRemainder} সেকেন্ড` : ""}{estMinutes === 0 && estSecondsRemainder === 0 ? "০ সেকেন্ড" : ""}
                    </>
                  ) : (
                    <>
                      {estMinutes > 0 ? `${estMinutes}m` : ""} {estSecondsRemainder > 0 ? `${estSecondsRemainder}s` : ""}{estMinutes === 0 && estSecondsRemainder === 0 ? "0s" : ""}
                    </>
                  )}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <p className="text-sm font-bold text-primary mb-3">
            {locale === "bn" ? "প্রশ্নের সংখ্যা নির্বাচন করো" : "Select number of questions"}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {[10, 15, 20, 25].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSelectedQuestionCount(count)}
                className={cn(
                  "px-5 py-2.5 text-sm font-bold rounded-xl border transition-all duration-200",
                  selectedQuestionCount === count
                    ? "border-primary bg-primary text-primary-foreground shadow-sm scale-105"
                    : "border-border bg-card text-muted-foreground hover:border-primary/45 hover:text-primary hover:bg-secondary/20"
                )}
              >
                {count} {locale === "bn" ? "টি প্রশ্ন" : "Questions"}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full rounded-xl font-bold sm:w-auto sm:min-w-[12rem]"
          onClick={startPractice}
          disabled={selectedChapters.length === 0}
        >
          <Brain className="mr-2 size-5" />
           Start Test
        </Button>
      </section>
    );
  }

  // --- PHASE: LOADING QUESTIONS ---
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
            {locale === "bn" 
              ? (countdownSeconds > 0 ? "পরীক্ষা শুরু হচ্ছে" : "পরীক্ষা প্রস্তুত")
              : (countdownSeconds > 0 ? "Starting Your Test" : "Test Ready")}
          </h2>
          <p className="text-xs text-muted font-semibold leading-relaxed">
            {locale === "bn"
              ? (countdownSeconds > 0 
                  ? `${countdownSeconds} সেকেন্ডের মধ্যে আপনার পরীক্ষাটি শুরু হতে যাচ্ছে...` 
                  : "পরীক্ষার প্রশ্ন লোড করা সম্পন্ন হয়েছে।")
              : (countdownSeconds > 0
                  ? `Your test is going to start in ${countdownSeconds} seconds...`
                  : "Questions loaded successfully.")}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "running") {
    return (
      <section className="space-y-5">
        {/* Offline Banner */}
        {isOffline && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm flex items-start gap-3 animate-in fade-in duration-300">
            <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">
                {locale === "bn" ? "আপনি এখন অফলাইন আছেন" : "You are Offline"}
              </h3>
              <p className="text-xs leading-5 text-red-700">
                {locale === "bn"
                  ? "আপনার ইন্টারনেট কানেকশন বিচ্ছিন্ন রয়েছে। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ বা বন্ধ করবেন না। আপনার উত্তরগুলো আপনার ব্রাউজারে সুরক্ষিত রয়েছে এবং ইন্টারনেট ফিরে আসলে সাবমিট করতে পারবেন।"
                  : "Your internet connection is currently disconnected. Please do not close or refresh this page. Your selected answers are saved locally, and you can submit them once your connection is restored."}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Test Mode
              </span>
              <h1 className="mt-1.5 font-display text-2xl font-bold text-primary sm:text-3xl">
                {displaySubject} {paperLabel} MCQ Test
              </h1>
              <p className="mt-2 text-sm text-muted">
                {answeredCount}/{questions.length} answered · pass mark {passMarkPercent}% · blank == wrong
              </p>
            </div>
             <PracticeTimer durationSeconds={totalDurationSeconds} onTimeUp={handleTimeUp} />
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

        {errorMessage && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="space-y-4">
          {questions.map((question, index) => {
            const selectedIndex = answers[question.id];

            return (
              <PracticeQuestionCard
                key={question.id}
                question={question}
                index={index}
                selectedIndex={selectedIndex}
                disabled={isTimeUp}
                onSelectOption={handleSelectOption}
              />
            );
          })}
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full rounded-xl"
          onClick={() => setShowSubmitConfirm(true)}
          loading={isSubmitting}
        >
          {isSubmitting
            ?  "Submitting..."
            :  `Submit test (${answeredCount}/${questions.length} answered)`}
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
                      {locale === "bn" ? "পরীক্ষা জমা দিতে চান?" : "Submit Test?"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {locale === "bn"
                        ? "জমা দেওয়ার পূর্বে আপনার উত্তরগুলো মিলিয়ে নিন।"
                        : "Please review your answers before submitting."}
                    </p>
                  </div>

                  {/* Visual Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        {locale === "bn" ? "উত্তর দেওয়া হয়েছে" : "Answered"}
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
                        {locale === "bn" ? "বাকি আছে" : "Unanswered"}
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
                        {locale === "bn"
                          ? "সতর্কতা: বাকি থাকা প্রশ্নগুলোর জন্য কোনো নম্বর পাওয়া যাবে না।"
                          : "Warning: Unanswered questions will receive no marks."}
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
                    {locale === "bn" ? "ফিরে যান" : "Cancel"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full rounded-xl py-2.5 font-bold"
                    onClick={() => {
                      setShowSubmitConfirm(false);
                      submitPractice();
                    }}
                  >
                    {locale === "bn" ? "জমা দিন" : "Submit Now"}
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
                    {locale === "bn" ? "সাবমিশন ব্যর্থ হয়েছে" : "Submission Failed"}
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
                  {locale === "bn" ? "ঠিক আছে" : "Close"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --- CUSTOM WARNING MODAL --- */}
        {showLeaveWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="size-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shrink-0">
                  <AlertTriangle className="size-6 text-brand-red animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-bold text-primary">
                    {locale === "bn" ? "পরীক্ষা চলমান আছে!" : "Exam in Progress!"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {locale === "bn"
                      ? "পরীক্ষা চলাকালীন আপনি অন্য পৃষ্ঠায় যেতে পারবেন না। অনুগ্রহ করে প্রথমে আপনার পরীক্ষাটি সাবমিট করুন।"
                      : "You cannot navigate to other pages during the test. Please submit your exam first."}
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
                    {locale === "bn" ? "পরীক্ষায় ফিরে যান" : "Back to Test"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full rounded-xl py-2.5 font-bold bg-brand-red text-white hover:bg-brand-red/90"
                    onClick={async () => {
                      setShowLeaveWarning(false);
                      await submitPractice();
                      if (pendingNavigationUrl) {
                        window.location.href = pendingNavigationUrl;
                      } else {
                        window.location.href = practiceListHref;
                      }
                    }}
                  >
                    {locale === "bn" ? "সাবমিট করে চলে যান" : "Submit & Leave"}
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
                    {locale === "bn" ? "ট্যাব পরিবর্তনের সতর্কতা!" : "Tab Change Warning!"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-semibold text-red-600">
                    {locale === "bn"
                      ? "আপনি উইন্ডো বা ট্যাব পরিবর্তন করেছেন! পরীক্ষা চলাকালীন পুনরায় ট্যাব বা উইন্ডো পরিবর্তন করলে আপনার পরীক্ষাটি বাতিল এবং স্বয়ংক্রিয়ভাবে সাবমিট হয়ে যাবে।"
                      : "You changed tabs or windows! If you change it again, your test will be cancelled and automatically submitted."}
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full rounded-xl py-2.5 font-bold"
                  onClick={() => setShowTabSwitchWarning(false)}
                >
                  {locale === "bn" ? "পরীক্ষায় ফিরে যান" : "Return to Test"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // --- PHASE: RESULTS REVIEW ---
  if (phase === "result" && result) {
    return (
      <section className="space-y-6">
        {wasAutoSubmittedDueToTabLeave && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm flex items-start gap-3 animate-in fade-in duration-300">
            <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">
                {locale === "bn" ? "পরীক্ষা বাতিল করা হয়েছে" : "Test Cancelled"}
              </h3>
              <p className="text-xs leading-5 text-red-700">
                {locale === "bn"
                  ? "পরীক্ষা চলাকালীন একাধিকবার ট্যাব বা উইন্ডো পরিবর্তন করার কারণে আপনার পরীক্ষাটি বাতিল করা হয়েছে এবং উত্তরগুলো স্বয়ংক্রিয়ভাবে সাবমিট করা হয়েছে।"
                  : "Your test was cancelled and automatically submitted because you changed windows or switched tabs multiple times."}
              </p>
            </div>
          </div>
        )}

        {/* Banner with warning details */}
        <div className="rounded-xl border border-brand-yellow/30 bg-yellow-50/80 p-4 shadow-sm flex items-start gap-3">
          <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-primary">
              {locale === "bn" ? "গুরুত্বপূর্ণ সতর্কতা" : "Important Warning"} 
            </h3>
            <p className="text-xs leading-5 text-muted">
              {locale === "bn"
                ? "পরে এই প্রশ্নের বিস্তারিত উত্তর দেখতে পাবে না। অনুগ্রহ করে এখান থেকে যাওয়ার আগে উত্তর ও ব্যাখ্যাগুলো মনোযোগ দিয়ে দেখে নাও!"
                : "You will NOT be able to view this detailed question review later (the database only stores your final score). Please review your answers and explanations carefully before navigating away!"}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border-2 p-5 shadow-[var(--shadow-md)] sm:p-6",
            result.result.isPassed ? "border-emerald-400 bg-emerald-50" : "border-brand-yellow/30 bg-secondary" 
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Test Result</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-primary">
                Score: {result.result.score}/{result.totalQuestions}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {result.result.percentage}% ·{" "}
                <span
                  className={
                    result.result.isPassed ? "font-semibold text-emerald-700" : "font-semibold text-brand-red"  
                  }
                >
                  {result.result.isPassed ? "Passed" : "Needs improvement"}
                </span>
                {" "}· Pass mark: {passMarkPercent}%
              </p>
            </div>
            <Link href={practiceListHref} className="shrink-0">
              <Button type="button" variant="outline" className="rounded-xl bg-surface hover:bg-secondary">     
                {locale === "bn" ? "ড্যাশবোর্ডে ফিরে যাও" : "Go to Dashboard"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => {
            const solution = result.solutions.find((item) => item.questionId === question.id);
            const selectedIndex = answers[question.id];
            const isUnanswered = selectedIndex === undefined;
            const isCorrect =
              !isUnanswered && selectedIndex === solution?.correctIndex;

            return (
              <article
                key={question.id}
                className="rounded-xl border-2 border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5"      
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
                      {question.imageUrl && (
                        <img
                          src={question.imageUrl}
                          alt="Question illustration"
                          className="mt-3 max-w-full max-h-64 w-auto rounded-lg object-contain border border-border/60 bg-muted/20"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold text-center whitespace-nowrap",
                        isUnanswered
                          ? "bg-red-50 text-brand-red"
                          : isCorrect
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-50 text-brand-red",
                      )}
                    >
                      {isUnanswered
                        ? locale === "bn"
                          ? "উত্তর দেওয়া হয়নি"
                          : "Unanswered"
                        : isCorrect
                          ? locale === "bn"
                            ? "সঠিক"
                            : "Correct"
                          : locale === "bn"
                            ? "ভুল"
                            : "Wrong"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReportingQuestionId(question.id);
                        setReportComment("");
                        setReportError("");
                        setReportSuccess(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-red-50 hover:text-brand-red hover:border-brand-red/30 transition-all duration-200"
                    >
                      <AlertTriangle className="size-3.5" />
                      {locale === "bn" ? "রিপোর্ট" : "Report"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2.5 sm:gap-3">
                  {question.options.map((option, optionIndex) => (
                    <McqOption
                      key={`${question.id}-${optionIndex}`}
                      label={getOptionLabel(optionIndex)}
                      optionText={option}
                      isSelected={selectedIndex === optionIndex}
                      disabled={true}
                      resultMode={getOptionResultMode(
                        optionIndex,
                        selectedIndex,
                        solution?.correctIndex,
                        true
                      )}
                      onSelect={() => {}}
                    />
                  ))}
                </div>

                {solution?.explanation && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 sm:p-4">       
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                      {locale === "bn" ? "সমাধানের ব্যাখ্যা" : "Solution Explanation"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">{solution.explanation}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <Link href={practiceListHref} className="block">
          <Button type="button" size="lg" className="w-full rounded-xl">
            {"Finish and Go Back"}
          </Button>
        </Link>

        {/* --- QUESTION REPORT MODAL --- */}
        {reportingQuestionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500 animate-bounce" />
                {locale === "bn" ? "প্রশ্ন রিপোর্ট করুন" : "Report Question"}
              </h3>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {locale === "bn"
                  ? "এই প্রশ্নটির কোনো ভুল বা সমস্যা থাকলে অনুগ্রহ করে নিচে মন্তব্য লিখুন।"
                  : "Please describe the issue with this question (e.g., wrong correct index, typo, bad options)."}
              </p>

              <textarea
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                rows={4}
                placeholder={locale === "bn" ? "আপনার মন্তব্য লিখুন..." : "Enter your comment..."}
                className="mt-4 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />

              {reportError && (
                <p className="mt-3 text-xs text-brand-red font-semibold">{reportError}</p>
              )}

              {reportSuccess && (
                <p className="mt-3 text-xs text-emerald-600 font-semibold">
                  {locale === "bn" ? "রিপোর্ট সফলভাবে জমা দেওয়া হয়েছে!" : "Report submitted successfully!"}
                </p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReportingQuestionId(null);
                    setReportComment("");
                    setReportError("");
                    setReportSuccess(false);
                  }}
                  disabled={isSubmittingReport}
                  className="rounded-xl"
                >
                  {locale === "bn" ? "বাতিল" : "Cancel"}
                </Button>
                <Button
                  type="button"
                  onClick={handleSendReport}
                  loading={isSubmittingReport}
                  disabled={isSubmittingReport || !reportComment.trim()}
                  className="rounded-xl"
                >
                  {locale === "bn" ? "জমা দিন" : "Submit"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return null;
}
