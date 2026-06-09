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
  chapters: string[];
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
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
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
            setSelectedChapters(matchingSubject.chapters); // Check all by default
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
    if (selectedChapters.length === availableChapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters([...availableChapters]);
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
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted">
          {locale === "bn" ? "অধ্যায়গুলো লোড হচ্ছে..." : "Loading test configuration..."}
        </p>
      </div>
    );
  }

  // --- PHASE: CONFIGURING ---
  if (phase === "configuring") {
    const estQuestionCount =
      selectedChapters.length > 0 ? Math.min(selectedChapters.length * 5, 25) : 0;
    const estTotalSeconds = estQuestionCount * secondsPerQuestion;
    const estMinutes = Math.floor(estTotalSeconds / 60);
    const estSecondsRemainder = estTotalSeconds % 60;
    const allSelected = selectedChapters.length === availableChapters.length;

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
                {displaySubject} MCQ Test
                {paperLabel && (
                  <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary align-middle">
                    {paperLabel}
                  </span>
                )}
              </h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">
            {locale === "bn"
              ? `অধ্যায় সিলেক্ট করুন। সর্বোচ্চ ২৫টি প্রশ্ন র্যান্ডমলি নেওয়া হবে। উত্তর না দিলে ভুল ধরা হবে। পাস মার্ক ${passMarkPercent}%।`
              : `Select chapters. Up to 25 random questions will be picked. Unanswered questions count as wrong. Pass mark: ${passMarkPercent}%.`}
          </p>
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
                {locale === "bn" ? "অধ্যায় নির্বাচন" : "Select chapters"}
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
                  ? "সব বাতিল"
                  : "Clear all"
                : locale === "bn"
                  ? "সব নির্বাচন"
                  : "Select all"}
            </button>
          </div>

          <div className="max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
            <ul className="space-y-1">
              {availableChapters.map((chapter) => {
                const isChecked = selectedChapters.includes(chapter);
                const displayName = getTranslatedChapter(chapter, locale);
                const inputId = `chapter-${chapter.replace(/[^a-z0-9]+/gi, "-")}`;

                return (
                  <li key={chapter}>
                    <label
                      htmlFor={inputId}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                        isChecked
                          ? "border-primary/30 bg-primary/5"
                          : "border-transparent hover:bg-secondary/50",
                      )}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChapter(chapter)}
                        className="mt-1 size-4 shrink-0 rounded border-border text-primary focus:ring-primary"
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm leading-snug",
                          isChecked ? "font-medium text-primary" : "text-foreground",
                        )}
                      >
                        {displayName}
                      </span>
                    </label>
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
                  {estQuestionCount > 0
                    ? `${estMinutes}m ${estSecondsRemainder > 0 ? `${estSecondsRemainder}s` : ""}`.trim()
                    : "—"}
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
          {locale === "bn" ? "পরীক্ষা শুরু করুন" : "Start Test"}
        </Button>
      </section>
    );
  }

  // --- PHASE: LOADING QUESTIONS ---
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted">
          {locale === "bn" ? "প্রশ্ন জেনারেট হচ্ছে..." : "Generating test questions..."}
        </p>
      </div>
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
                {displaySubject} MCQ Test
                {paperLabel && (
                  <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary align-middle">
                    {paperLabel}
                  </span>
                )}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {answeredCount}/{questions.length}{" "}
                {locale === "bn" ? "উত্তর দেওয়া হয়েছে" : "answered"} ·{" "}
                {locale === "bn" ? "পাস মার্ক" : "pass mark"} {passMarkPercent}% ·{" "}
                {locale === "bn" ? "খালি = ভুল" : "blank = wrong"}
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
            ? locale === "bn"
              ? "সাবমিট হচ্ছে..."
              : "Submitting..."
            : locale === "bn"
              ? `পরীক্ষা শেষ করুন (${answeredCount}/${questions.length} উত্তর)`
              : `Submit test (${answeredCount}/${questions.length} answered)`}
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
                ? "আপনি পরে এই প্রশ্নের বিস্তারিত উত্তর দেখতে পাবেন না (ডাটাবেসে শুধু মোট স্কোরটি সেভ করা থাকবে)। অনুগ্রহ করে এখান থেকে যাওয়ার আগে আপনার উত্তর ও ব্যাখ্যাগুলো মনোযোগ দিয়ে দেখে নিন!"
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
                {locale === "bn" ? "ড্যাশবোর্ডে ফিরে যান" : "Go to Dashboard"}
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
            {locale === "bn" ? "সমাপ্ত করুন এবং ফিরে যান" : "Finish and Go Back"}
          </Button>
        </Link>
      </section>
    );
  }

  return null;
}
