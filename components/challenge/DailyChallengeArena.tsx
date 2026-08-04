"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  LockKeyhole,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  XCircle,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  apiFetch,
  getApiErrorMessage,
  isApiSuccess,
} from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

type ChallengeQuestion = {
  id: string;
  question: string;
  options: string[];
  imageUrl?: string;
  subject: string;
};

type ChallengeSolution = {
  questionId: string;
  question: string;
  options: string[];
  imageUrl?: string;
  subject: string;
  selectedIndex: number | null;
  correctIndex: number;
  explanation?: string;
};

type ChallengeResult = {
  score: number;
  totalQuestions: number;
  percentage: number;
  xpEarned: number;
  timeTakenSeconds: number;
  solutions: ChallengeSolution[];
};

type ChallengeStatus = {
  available: boolean;
  message?: string;
  dateKey?: string;
  subjects?: string[];
  questionCount?: number;
  durationSeconds?: number;
  status?: "ready" | "started" | "submitted" | "expired";
  attempt?: ChallengeResult | null;
  challengeStreak?: number;
  classPulse?: {
    completedCount: number;
    classSize: number;
    percent: number;
  };
  recentResults?: Array<{
    dateKey: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    xpEarned: number;
  }>;
};

type StartedChallenge = {
  attemptId: string;
  dateKey: string;
  subjects: string[];
  durationSeconds: number;
  remainingSeconds: number;
  questions: ChallengeQuestion[];
};

type SubmitResponse = {
  result: ChallengeResult;
  reward?: {
    xp: number;
    breakdown: {
      completion: number;
      correctAnswers: number;
      speed: number;
      perfect: number;
    };
    profile: { totalXp: number; level: number };
  };
  challengeStreak?: number;
};

const optionLabels = ["ক", "খ", "গ", "ঘ"];

export function DailyChallengeArena() {
  const [status, setStatus] = useState<ChallengeStatus | null>(null);
  const [active, setActive] = useState<StartedChallenge | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [reward, setReward] = useState<SubmitResponse["reward"]>();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const viewed = useRef(false);

  async function loadStatus() {
    const response = await apiFetch<ChallengeStatus>("/api/challenge");
    if (response.ok && isApiSuccess(response.payload)) {
      setStatus(response.payload.data);
      if (response.payload.data.attempt) {
        setResult(response.payload.data.attempt);
      }
    } else {
      setMessage(
        getApiErrorMessage(
          response.payload,
          "আজকের চ্যালেঞ্জ এখন লোড করা যাচ্ছে না।",
        ),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const response = await apiFetch<ChallengeStatus>("/api/challenge");
      if (!mounted) return;
      if (response.ok && isApiSuccess(response.payload)) {
        setStatus(response.payload.data);
        if (response.payload.data.attempt) {
          setResult(response.payload.data.attempt);
        }
      } else {
        setMessage(
          getApiErrorMessage(
            response.payload,
            "আজকের চ্যালেঞ্জ এখন লোড করা যাচ্ছে না।",
          ),
        );
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (status && !viewed.current) {
      viewed.current = true;
      trackStudentEvent("student_challenge_viewed", "daily_challenge", {
        available: status.available,
        status: status.status ?? "unavailable",
      });
    }
  }, [status]);

  useEffect(() => {
    if (!active || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [active, secondsLeft]);

  async function startChallenge() {
    setBusy(true);
    setMessage("");
    const response = await apiFetch<StartedChallenge>("/api/challenge/start", {
      method: "POST",
    });
    if (response.ok && isApiSuccess(response.payload)) {
      setActive(response.payload.data);
      setSecondsLeft(response.payload.data.remainingSeconds);
      setAnswers({});
      trackStudentEvent("student_challenge_started", "daily_challenge", {
        question_count: response.payload.data.questions.length,
      });
    } else {
      setMessage(
        getApiErrorMessage(
          response.payload,
          "চ্যালেঞ্জটি এখন শুরু করা যাচ্ছে না।",
        ),
      );
      await loadStatus();
    }
    setBusy(false);
  }

  async function submitChallenge() {
    if (!active || busy) return;
    setBusy(true);
    setMessage("");
    const response = await apiFetch<SubmitResponse>("/api/challenge/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: active.attemptId,
        answers: active.questions.map((question) => ({
          questionId: question.id,
          selectedIndex: answers[question.id] ?? null,
        })),
      }),
    });
    if (response.ok && isApiSuccess(response.payload)) {
      setResult(response.payload.data.result);
      setReward(response.payload.data.reward);
      setActive(null);
      trackStudentEvent("student_challenge_completed", "daily_challenge", {
        score: response.payload.data.result.score,
        percentage: response.payload.data.result.percentage,
        xp: response.payload.data.result.xpEarned,
      });
      await loadStatus();
    } else {
      setMessage(
        getApiErrorMessage(
          response.payload,
          "চ্যালেঞ্জটি জমা দেওয়া যাচ্ছে না।",
        ),
      );
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="দৈনিক চ্যালেঞ্জ লোড হচ্ছে">
        <div className="h-64 animate-pulse rounded-3xl bg-orange-100" />
        <div className="h-80 animate-pulse rounded-2xl bg-secondary" />
      </div>
    );
  }

  if (!status?.available) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <LockKeyhole className="mx-auto size-9 text-amber-700" />
        <h1 className="mt-3 text-xl font-black text-primary">
          আজকের চ্যালেঞ্জ প্রস্তুত হচ্ছে
        </h1>
        <p className="mt-2 text-sm text-muted">
          {status?.message || message || "কিছুক্ষণ পর আবার চেষ্টা করুন।"}
        </p>
      </div>
    );
  }

  if (active) {
    const answeredCount = Object.keys(answers).length;
    const timeTone =
      secondsLeft <= 15
        ? "border-red-300 bg-red-50 text-red-700"
        : "border-orange-200 bg-orange-50 text-orange-700";
    return (
      <section className="space-y-5">
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">
              আজকের ৫ প্রশ্ন
            </p>
            <p className="mt-1 text-sm font-bold text-primary">
              উত্তর দেওয়া হয়েছে {answeredCount}/{active.questions.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-black",
                timeTone,
              )}
            >
              <Clock3 className="size-4" />
              {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
            <Button
              className="rounded-xl"
              loading={busy}
              onClick={() => void submitChallenge()}
            >
              {secondsLeft === 0 ? "সময় শেষ—জমা দিন" : "জমা দিন"}
            </Button>
          </div>
        </div>

        {message && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
            {message}
          </p>
        )}

        {active.questions.map((question, questionIndex) => (
          <article
            key={question.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-600 text-sm font-black text-white">
                {questionIndex + 1}
              </span>
              <div className="min-w-0 flex-1">
                <span className="rounded-full bg-orange-100 px-2 py-1 text-2xs font-black text-orange-800">
                  {question.subject}
                </span>
                <h2 className="mt-2 text-base font-black leading-7 text-primary sm:text-lg">
                  {question.question}
                </h2>
                {question.imageUrl && (
                  <Image
                    src={question.imageUrl}
                    alt="প্রশ্নের ছবি"
                    width={720}
                    height={480}
                    className="mt-3 max-h-64 w-auto rounded-xl border border-border object-contain"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => {
                const selected = answers[question.id] === optionIndex;
                return (
                  <button
                    key={`${question.id}-${optionIndex}`}
                    type="button"
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: optionIndex,
                      }))
                    }
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl border-2 p-3 text-left text-sm font-semibold transition",
                      selected
                        ? "border-orange-500 bg-orange-50 text-orange-900"
                        : "border-border bg-surface text-primary hover:border-orange-300 hover:bg-orange-50/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-black",
                        selected
                          ? "bg-orange-600 text-white"
                          : "bg-secondary text-muted",
                      )}
                    >
                      {optionLabels[optionIndex]}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    );
  }

  if (result) {
    return (
      <ChallengeResultView
        result={result}
        reward={reward}
        streak={status.challengeStreak ?? 0}
        onRefresh={() => void loadStatus()}
      />
    );
  }

  const pulse = status.classPulse ?? {
    completedCount: 0,
    classSize: 0,
    percent: 0,
  };

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-rose-600 to-violet-800 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 left-1/3 size-48 rounded-full bg-yellow-300/10" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-200">
              <Zap className="size-5" />
              প্রতিদিন নতুন রাউন্ড
            </div>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              ডেইলি চ্যালেঞ্জ এরিনা
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
              ৯০ সেকেন্ডে ৫টি প্রশ্ন। দ্রুত ভাবুন, উত্তর দিন এবং শেষে প্রতিটি
              সমাধান দেখে শিখে নিন।
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                <Target className="mr-1.5 inline size-4 text-yellow-200" />
                {status.questionCount} প্রশ্ন
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                <Clock3 className="mr-1.5 inline size-4 text-cyan-200" />
                {status.durationSeconds} সেকেন্ড
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                <Flame className="mr-1.5 inline size-4 text-orange-200" />
                {status.challengeStreak} দিনের চ্যালেঞ্জ স্ট্রিক
              </span>
            </div>
            <Button
              size="lg"
              className="mt-6 rounded-xl bg-yellow-300 text-orange-950 hover:bg-yellow-200"
              loading={busy}
              onClick={() => void startChallenge()}
            >
              <Play className="size-5" />
              {status.status === "started" ? "চ্যালেঞ্জ চালিয়ে যান" : "আজকের চ্যালেঞ্জ শুরু করুন"}
            </Button>
          </div>
          <div className="mx-auto grid size-40 place-items-center rounded-full border-4 border-white/20 bg-white/10 text-center shadow-2xl backdrop-blur">
            <div>
              <Gauge className="mx-auto size-10 text-yellow-200" />
              <p className="mt-1 text-4xl font-black">5</p>
              <p className="text-2xs font-black uppercase tracking-widest text-white/70">
                প্রশ্ন
              </p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          {message}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5">
          <div className="flex items-center gap-2">
            <UsersRound className="size-6 text-cyan-700" />
            <h2 className="text-lg font-black text-primary">আজকের ক্লাস পালস</h2>
          </div>
          <p className="mt-2 text-sm text-muted">
            {pulse.completedCount} জন আজকের রাউন্ড শেষ করেছে—কারও নম্বর দেখানো হয় না।
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-cyan-100">
            <div
              className="h-full rounded-full bg-cyan-600"
              style={{ width: `${pulse.percent}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs font-black text-cyan-800">
            {pulse.percent}% অংশগ্রহণ
          </p>
        </article>

        <article className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
          <div className="flex items-center gap-2">
            <Trophy className="size-6 text-violet-700" />
            <h2 className="text-lg font-black text-primary">কীভাবে XP পাবেন</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white p-3">
              <p className="text-lg font-black text-violet-800">+10</p>
              <p className="text-2xs font-bold text-muted">রাউন্ড শেষ</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-lg font-black text-violet-800">+4</p>
              <p className="text-2xs font-bold text-muted">প্রতি সঠিক উত্তর</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-lg font-black text-violet-800">+10</p>
              <p className="text-2xs font-bold text-muted">দ্রুত শেষ</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-lg font-black text-violet-800">+10</p>
              <p className="text-2xs font-bold text-muted">সব সঠিক</p>
            </div>
          </div>
        </article>
      </div>

      {(status.recentResults?.length ?? 0) > 0 && (
        <article className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-black text-primary">সাম্প্রতিক রাউন্ড</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {status.recentResults?.map((item) => (
              <div key={item.dateKey} className="rounded-xl bg-secondary/70 p-3">
                <p className="text-xs font-black text-primary">{item.dateKey}</p>
                <p className="mt-1 text-sm font-bold text-violet-700">
                  {item.score}/{item.totalQuestions} · +{item.xpEarned} XP
                </p>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}

function ChallengeResultView({
  result,
  reward,
  streak,
  onRefresh,
}: {
  result: ChallengeResult;
  reward?: SubmitResponse["reward"];
  streak: number;
  onRefresh: () => void;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-800 p-6 text-center text-white shadow-xl">
        <Sparkles className="mx-auto size-9 text-yellow-300" />
        <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
          আজকের রাউন্ড সম্পন্ন
        </p>
        <h1 className="mt-2 text-4xl font-black">
          {result.score}/{result.totalQuestions}
        </h1>
        <p className="mt-1 text-sm font-bold text-white/75">
          {Math.round(result.percentage)}% সঠিক · {result.timeTakenSeconds} সেকেন্ড
        </p>
        <div className="mx-auto mt-5 flex max-w-sm justify-center gap-3">
          <span className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black">
            +{result.xpEarned} XP
          </span>
          <span className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black">
            <Flame className="mr-1 inline size-4 text-orange-300" />
            {streak} দিন
          </span>
        </div>
        {reward && (
          <p className="mt-3 text-2xs font-semibold text-white/70">
            সমাপ্তি {reward.breakdown.completion} · সঠিক উত্তর{" "}
            {reward.breakdown.correctAnswers} · গতি {reward.breakdown.speed} ·
            পারফেক্ট {reward.breakdown.perfect}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {result.solutions.map((solution, index) => {
          const correct = solution.selectedIndex === solution.correctIndex;
          return (
            <article
              key={solution.questionId}
              className={cn(
                "rounded-2xl border p-4 sm:p-5",
                correct
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-red-200 bg-red-50/40",
              )}
            >
              <div className="flex items-start gap-3">
                {correct ? (
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 size-6 shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-black uppercase tracking-wider text-muted">
                    প্রশ্ন {index + 1} · {solution.subject}
                  </p>
                  <h2 className="mt-1 font-black leading-7 text-primary">
                    {solution.question}
                  </h2>
                  {solution.imageUrl && (
                    <Image
                      src={solution.imageUrl}
                      alt="প্রশ্নের ছবি"
                      width={720}
                      height={480}
                      className="mt-3 max-h-56 w-auto rounded-xl border border-border object-contain"
                    />
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {solution.options.map((option, optionIndex) => (
                  <div
                    key={`${solution.questionId}-${optionIndex}`}
                    className={cn(
                      "rounded-xl border p-3 text-sm font-semibold",
                      optionIndex === solution.correctIndex
                        ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                        : optionIndex === solution.selectedIndex
                          ? "border-red-300 bg-red-100 text-red-900"
                          : "border-border bg-white/70 text-muted",
                    )}
                  >
                    <span className="mr-2 font-black">{optionLabels[optionIndex]}.</span>
                    {option}
                  </div>
                ))}
              </div>
              {solution.explanation && (
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-2xs font-black uppercase tracking-wider text-sky-800">
                    কেন এই উত্তর
                  </p>
                  <p className="mt-1 text-sm leading-6 text-sky-950">
                    {solution.explanation}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" className="rounded-xl" onClick={onRefresh}>
          <RotateCcw className="size-4" />
          ফলাফল রিফ্রেশ
        </Button>
        <Link
          href="/student/practice"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground"
        >
          আরও অনুশীলন <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
