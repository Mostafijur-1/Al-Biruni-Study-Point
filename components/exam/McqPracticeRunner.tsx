"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, Brain, Clock } from "lucide-react";

import { useRouter } from "next/navigation";
import { guestLevelQuery, useGuestLevel } from "@/lib/hooks/use-guest-level";
import { useSession } from "@/lib/hooks/use-session";
import { getOptionLabel, McqOption } from "@/components/exam/McqOption";
import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { createLocalizedPath } from "@/lib/i18n";
import { getTranslatedChapter } from "@/lib/content/syllabus";
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
  locale: string;
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

export function McqPracticeRunner({ subject, locale }: McqPracticeRunnerProps) {
  const path = createLocalizedPath(locale as any);
  const router = useRouter();
  const { user, checking } = useSession({ listenToAuthChanges: true });
  const isGuest = !user;
  const level = useGuestLevel();
  const practiceListHref = path(`/student/practice${isGuest ? guestLevelQuery(level) : ""}`);

  // States
  const [phase, setPhase] = useState<"configuring" | "loading" | "running" | "result">("configuring");
  const [availableChapters, setAvailableChapters] = useState<Array<{ name: string; hasMcqs: boolean }>>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(0);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState<number>(45);
  const [passMarkPercent, setPassMarkPercent] = useState<number>(60);
  const [result, setResult] = useState<PracticeSubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  // Load subject status and chapters
  useEffect(() => {
    if (checking) return;

    async function loadConfig() {
      try {
        const url = isGuest
          ? `/api/mcq/practice/status?scope=guest&level=${level}`
          : "/api/mcq/practice/status";
        const { ok, payload } = await apiFetch<{ status: ChapterStatus[] }>(url);
        if (ok && isApiSuccess(payload)) {
          const matchingSubject = payload.data.status.find((s) => s.subject === subject);
          if (matchingSubject) {
            setAvailableChapters(matchingSubject.chapters);
            // Check only chapters that have MCQs by default!
            const enabledChapters = matchingSubject.chapters
              .filter((c) => c.hasMcqs)
              .map((c) => c.name);
            setSelectedChapters(enabledChapters);
          } else {
            setErrorMessage(
              locale === "bn"
                ? "এই বিষয়ের জন্য কোনো অধ্যায় পাওয়া যায়নি।"
                : "No chapters found for this subject."
            );
          }
        } else {
          setErrorMessage(getApiErrorMessage(payload, "Could not load practice chapters."));
        }
      } catch {
        setErrorMessage("An unexpected error occurred while loading settings.");
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, [subject, locale, checking, isGuest, level]);

  // Exam Timer — counts down in seconds
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || phase !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current === null ? current : Math.max(0, current - 1)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [secondsLeft, phase]);

  // Handle auto-submit on time expiry
  useEffect(() => {
    if (secondsLeft === 0 && phase === "running" && !result) {
      submitPractice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  // Toggle chapter selection
  function toggleChapter(chapterName: string) {
    setSelectedChapters((prev) =>
      prev.includes(chapterName)
        ? prev.filter((c) => c !== chapterName)
        : [...prev, chapterName]
    );
  }

  // Toggle all chapters
  function toggleSelectAll() {
    const enabledChapters = availableChapters.filter((c) => c.hasMcqs).map((c) => c.name);
    if (selectedChapters.length === enabledChapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(enabledChapters);
    }
  }

  // Start practice session
  async function startPractice() {
    if (selectedChapters.length === 0) return;

    if (isGuest) {
      const nextPath = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.push(`/${locale}/login?next=${nextPath}&reason=access`);
      return;
    }

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
      }>(`/api/mcq/practice/start?subject=${encodeURIComponent(subject)}&chapters=${chaptersQuery}`);

      if (!ok || !isApiSuccess(payload)) {
        setErrorMessage(getApiErrorMessage(payload, "Could not start practice exam."));
        setPhase("configuring");
        return;
      }

      const data = payload.data;
      setQuestions(data.questions);
      setTotalDurationSeconds(data.durationSeconds);
      setSecondsLeft(data.durationSeconds);
      setSecondsPerQuestion(data.secondsPerQuestion);
      setPassMarkPercent(data.passMarkPercent);
      setAnswers({});
      setResult(null);
      setPhase("running");
    } catch {
      setErrorMessage("Could not connect to server to fetch practice questions.");
      setPhase("configuring");
    }
  }

  function buildSubmitAnswers() {
    return questions.map((question) => ({
      questionId: question.id,
      selectedIndex: answers[question.id] ?? null,
    }));
  }

  // Submit practice attempt
  async function submitPractice() {
    if (phase !== "running" || isSubmitting || questions.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage("");

    const elapsedSeconds = totalDurationSeconds - (secondsLeft || 0);

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
          }),
        }
      );

      if (!ok || !isApiSuccess(payload)) {
        setErrorMessage(getApiErrorMessage(payload, "Submission failed. Please try again."));
        setIsSubmitting(false);
        return;
      }

      setResult(payload.data);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrorMessage("An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Display subject name (strip "1st Paper" / "2nd Paper" suffix for heading)
  const displaySubject = subject.replace(/ (1st|2nd) Paper$/, "");
  const paperLabel = subject !== displaySubject
    ? subject.match(/(1st|2nd) Paper$/)?.[0]
    : null;

  // UI Renderers
  if (loadingConfig) {
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
    const estQuestionCount =
      selectedChapters.length > 0 ? Math.min(selectedChapters.length * 5, 25) : 0;
    const estTotalSeconds = estQuestionCount * secondsPerQuestion;
    const estMinutes = Math.floor(estTotalSeconds / 60);
    const estSecondsRemainder = estTotalSeconds % 60;
    const enabledChapters = availableChapters.filter((c) => c.hasMcqs);
    const allSelected =
      enabledChapters.length > 0 &&
      selectedChapters.length === enabledChapters.length;

    return (
      <section className="space-y-4">
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
                {locale === "bn" ? "চ্যাপ্টার সিলেক্ট করো" : "Select chapters"}
              </h2>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {selectedChapters.length}/{availableChapters.length}
              </span>
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
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availableChapters.map((chapInfo) => {
                const chapter = chapInfo.name;
                const isChecked = selectedChapters.includes(chapter);
                const displayName = getTranslatedChapter(chapter, locale);
                const inputId = `chapter-${chapter.replace(/[^a-z0-9]+/gi, "-")}`;
                const isDisabled = !chapInfo.hasMcqs;

                return (
                  <li key={chapter}>
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors h-full",
                        isDisabled
                          ? "border-border/40 opacity-60 cursor-not-allowed bg-secondary/10"
                          : isChecked
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-card hover:border-primary/20 hover:bg-secondary/40",
                      )}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => toggleChapter(chapter)}
                        className="mt-1 size-4 shrink-0 rounded border-border text-primary focus:ring-primary disabled:opacity-50 cursor-pointer"
                      />
                      <label
                        htmlFor={isDisabled ? undefined : inputId}
                        className={cn(
                          "min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 select-none",
                          isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm leading-snug",
                            isChecked ? "font-medium text-primary" : "text-foreground",
                          )}
                        >
                          {displayName}
                        </span>
                        {isDisabled && (
                          <span className="shrink-0 text-2xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100/50">
                            {locale === "bn" ? "এমসিকিউ শীঘ্রই যুক্ত করা হবে" : "MCQ will be added soon"}
                          </span>
                        )}
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-border bg-secondary/20 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "অধ্যায়" : "Chapters"}:{" "}
                <strong className="text-primary">{selectedChapters.length}</strong>
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "সময়/প্রশ্ন" : "Per question"}:{" "}
                <strong className="text-primary">{secondsPerQuestion}s</strong>
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "পাস মার্ক" : "Pass mark"}:{" "}
                <strong className="text-primary">{passMarkPercent}%</strong>
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                {locale === "bn" ? "আনুমানিক সময়" : "Est. time"}:{" "}
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
      <section className="space-y-5 animate-pulse">
        {/* Header Skeleton */}
        <div className="rounded-xl border border-border bg-card/40 p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <div className="space-y-3">
            <div className="h-5 w-20 rounded-full bg-secondary" />
            <div className="h-7 w-1/3 rounded bg-secondary" />
            <div className="h-4 w-1/2 rounded bg-secondary" />
          </div>
        </div>

        {/* Question Cards Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card/40 p-4 space-y-4 shadow-[var(--shadow-sm)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-secondary shrink-0" />
                <div className="h-5 w-2/3 rounded bg-secondary" />
              </div>
              <div className="grid gap-2.5 sm:gap-3 pl-11">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-10 rounded-lg border border-border/40 bg-secondary/10" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // --- PHASE: RUNNING EXAM ---
  const minutes = Math.floor((secondsLeft || 0) / 60);
  const seconds = String((secondsLeft || 0) % 60).padStart(2, "0");
  const isLowTime = (secondsLeft ?? 0) <= 60;

  if (phase === "running") {
    return (
      <section className="space-y-5">
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
                {answeredCount}/{questions.length}{" "}
                {"answered"} ·{" "}
                {"pass mark"} {passMarkPercent}% ·{" "}
                {"blank == wrong"}
              </p>
            </div>
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
            const isAnswered = selectedIndex !== undefined;

            return (
              <article
                key={question.id}
                className={cn(
                  "rounded-xl border-2 bg-card p-4 shadow-[var(--shadow-sm)] transition-colors sm:p-5",
                  isAnswered ? "border-primary/25" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <h2 className="pt-0.5 text-base font-bold leading-snug text-foreground sm:text-lg">
                      {question.question}
                    </h2>
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
                      onSelect={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: optionIndex,
                        }))
                      }
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full rounded-xl"
          onClick={submitPractice}
          loading={isSubmitting}
        >
          {isSubmitting
            ?  "Submitting..."
            :  `Submit test (${answeredCount}/${questions.length} answered)`}
        </Button>
      </section>
    );
  }

  // --- PHASE: RESULTS REVIEW ---
  if (phase === "result" && result) {
    return (
      <section className="space-y-6">
        {/* Banner with warning details */}
        <div className="rounded-xl border border-brand-yellow/30 bg-yellow-50/80 p-4 shadow-sm flex items-start gap-3">
          <AlertTriangle className="size-6 text-brand-red shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-primary">
              {locale === "bn" ? "গুরুত্বপূর্ণ সতর্কতা" : "Important Warning"}
            </h3>
            <p className="text-xs leading-5 text-muted">
              {locale === "bn"
                ? "পরে এই প্রশ্নের বিস্তারিত উত্তর দেখতে পাবে না। অনুগ্রহ করে এখান থেকে যাওয়ার আগে উত্তর ও ব্যাখ্যাগুলো মনোযোগ দিয়ে দেখে নাও!"
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
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <h2 className="pt-0.5 text-base font-bold leading-snug text-foreground sm:text-lg">
                      {question.question}
                    </h2>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      isUnanswered
                        ? "bg-red-50 text-brand-red"
                        : isCorrect
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-50 text-brand-red",
                    )}
                  >
                    {isUnanswered
                      ? locale === "bn"
                        ? "উত্তর দেওয়া হয়নি"
                        : "Unanswered"
                      : isCorrect
                        ? locale === "bn"
                          ? "সঠিক"
                          : "Correct"
                        : locale === "bn"
                          ? "ভুল"
                          : "Wrong"}
                  </span>
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
      </section>
    );
  }

  return null;
}
