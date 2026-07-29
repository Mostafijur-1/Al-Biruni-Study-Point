"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  Flame,
  Play,
  Sparkles,
  Target,
  TimerReset,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  apiFetch,
  getApiErrorMessage,
  isApiSuccess,
} from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

type FocusIntention = "practice" | "review" | "lesson" | "assignment";
type FocusReflection = "energized" | "steady" | "challenging";

type FocusSession = {
  id: string;
  subject: string;
  intention: FocusIntention;
  intentionLabel: string;
  durationMinutes: number;
  status: string;
  startedAt: string;
  endsAt: string;
  reflection?: FocusReflection;
  reflectionLabel: string | null;
  xpEarned: number;
  dateKey: string;
};

type FocusStatus = {
  subjects: string[];
  intentions: Array<{ value: FocusIntention; label: string }>;
  reflections: Array<{ value: FocusReflection; label: string }>;
  durations: number[];
  current: FocusSession | null;
  canCompleteCurrent: boolean;
  totals: {
    todayMinutes: number;
    weekMinutes: number;
    weeklyGoalMinutes: number;
    weeklyPercent: number;
    completedSessions: number;
    focusStreak: number;
  };
  activeClassmates: number;
  recentSessions: FocusSession[];
};

type StartResponse = {
  ok: true;
  alreadyActive: boolean;
  session: FocusSession;
};

type CompleteResponse = {
  ok: true;
  alreadyCompleted: boolean;
  session: FocusSession;
  reward?: {
    xp: number;
    profile: { totalXp: number; level: number; currentStreak: number };
  };
};

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("bn-BD", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateKey}T12:00:00+06:00`));
}

export function FocusStudio() {
  const [status, setStatus] = useState<FocusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [subject, setSubject] = useState("");
  const [intention, setIntention] = useState<FocusIntention>("practice");
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [reflection, setReflection] = useState<FocusReflection>("steady");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const viewTracked = useRef(false);

  const loadStatus = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const result = await apiFetch<FocusStatus>("/api/focus");
    if (result.ok && isApiSuccess(result.payload)) {
      setStatus(result.payload.data);
      setError("");
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "ফোকাস স্টুডিও লোড করা যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<FocusStatus>("/api/focus");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        setStatus(result.payload.data);
      } else {
        setError(
          getApiErrorMessage(
            result.payload,
            "ফোকাস স্টুডিও লোড করা যায়নি। আবার চেষ্টা করুন।",
          ),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !viewTracked.current) {
      viewTracked.current = true;
      trackStudentEvent("student_focus_viewed", "focus_studio", {
        has_active_session: Boolean(status?.current),
      });
    }
  }, [loading, status]);

  const currentSessionId = status?.current?.id;
  useEffect(() => {
    if (!currentSessionId) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [currentSessionId]);

  const activeSubject = subject || status?.subjects[0] || "";
  const current = status?.current;
  const secondsLeft = current
    ? Math.max(0, Math.ceil((new Date(current.endsAt).getTime() - nowMs) / 1_000))
    : 0;
  const timerFinished = Boolean(current && secondsLeft === 0);
  const progress = current
    ? Math.min(
        1,
        Math.max(
          0,
          1 - secondsLeft / Math.max(1, current.durationMinutes * 60),
        ),
      )
    : 0;
  const ringOffset = 289 - 289 * progress;

  const recentTotal = useMemo(
    () =>
      status?.recentSessions.reduce(
        (total, session) => total + session.durationMinutes,
        0,
      ) ?? 0,
    [status?.recentSessions],
  );

  async function startSession() {
    if (!activeSubject) return;
    setWorking(true);
    setError("");
    setNotice("");
    const result = await apiFetch<StartResponse>("/api/focus/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: activeSubject,
        intention,
        durationMinutes,
      }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const startData = result.payload.data;
      const session = startData.session;
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              current: session,
              activeClassmates: startData.alreadyActive
                ? previous.activeClassmates
                : previous.activeClassmates + 1,
            }
          : previous,
      );
      setNowMs(Date.now());
      trackStudentEvent("student_focus_started", "focus_studio", {
        subject: session.subject,
        intention: session.intention,
        duration_minutes: session.durationMinutes,
      });
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "সেশন শুরু করা যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  async function completeSession() {
    if (!current || !timerFinished) return;
    setWorking(true);
    setError("");
    const result = await apiFetch<CompleteResponse>("/api/focus/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: current.id, reflection }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const xp = result.payload.data.reward?.xp ?? current.xpEarned;
      setNotice(
        xp > 0
          ? `দারুণ! সেশন সম্পন্ন হয়েছে—আপনি +${xp} XP পেয়েছেন।`
          : "দারুণ! আজকের XP সীমা পূর্ণ হলেও সেশনটি আপনার অগ্রগতিতে যোগ হয়েছে।",
      );
      trackStudentEvent("student_focus_completed", "focus_studio", {
        subject: current.subject,
        intention: current.intention,
        duration_minutes: current.durationMinutes,
        reflection,
        xp_earned: xp,
      });
      await loadStatus();
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "সেশন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  async function cancelSession() {
    if (!current) return;
    setWorking(true);
    setError("");
    const result = await apiFetch<{ ok: true }>("/api/focus/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: current.id }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      setNotice("সেশনটি বন্ধ করা হয়েছে। প্রস্তুত হলে আবার শুরু করুন।");
      await loadStatus();
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "সেশন বন্ধ করা যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="ফোকাস স্টুডিও লোড হচ্ছে">
        <div className="h-48 animate-pulse rounded-3xl bg-emerald-100" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-secondary/70"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-3xl bg-secondary/70" />
      </div>
    );
  }

  if (!status) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <Brain className="mx-auto size-9 text-red-600" />
        <h1 className="mt-3 text-xl font-black text-primary">
          ফোকাস স্টুডিও খোলা যায়নি
        </h1>
        <p className="mt-2 text-sm text-red-800">{error}</p>
        <Button className="mt-5 rounded-xl" onClick={() => loadStatus(true)}>
          আবার চেষ্টা করুন
        </Button>
      </section>
    );
  }

  if (current) {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
          >
            {error}
          </div>
        )}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-900 to-cyan-900 px-5 py-8 text-white shadow-xl sm:px-10 sm:py-10">
          <div
            aria-hidden
            className="absolute -right-20 -top-24 size-64 rounded-full bg-emerald-300/10 blur-2xl"
          />
          <div className="relative text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              <Sparkles className="size-4" />
              মনোযোগের সময়
            </div>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">
              {current.subject}
            </h1>
            <p className="mt-1 text-sm font-semibold text-white/70">
              {current.intentionLabel} · {current.durationMinutes} মিনিট
            </p>

            <div className="relative mx-auto mt-7 grid size-60 place-items-center sm:size-72">
              <svg
                viewBox="0 0 100 100"
                className="-rotate-90"
                aria-hidden
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-white/10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="289"
                  strokeDashoffset={ringOffset}
                  className="text-emerald-300 transition-[stroke-dashoffset] duration-1000"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div>
                  {timerFinished ? (
                    <CheckCircle2 className="mx-auto size-12 text-emerald-300" />
                  ) : (
                    <p
                      className="font-mono text-5xl font-black tabular-nums sm:text-6xl"
                      aria-live="off"
                    >
                      {formatTimer(secondsLeft)}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-bold text-emerald-100/75">
                    {timerFinished ? "সেশন শেষ—নিজেকে মূল্যায়ন করুন" : "শুধু এই কাজেই মন দিন"}
                  </p>
                </div>
              </div>
            </div>

            {!timerFinished ? (
              <div className="mt-6">
                <p className="text-xs font-semibold leading-5 text-white/60">
                  টাইমার শেষ হওয়া পর্যন্ত এই সেশনটি চালু রাখুন। চাইলে অন্য ট্যাবে
                  পড়াশোনা করতে পারেন।
                </p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  loading={working}
                  onClick={cancelSession}
                >
                  <X className="size-4" />
                  সেশন বন্ধ করুন
                </Button>
              </div>
            ) : (
              <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/10 p-4 text-left backdrop-blur-sm sm:p-5">
                <p className="text-sm font-black text-white">
                  সেশনটি কেমন ছিল?
                </p>
                <div className="mt-3 grid gap-2">
                  {status.reflections.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setReflection(item.value)}
                      aria-pressed={reflection === item.value}
                      className={cn(
                        "min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
                        reflection === item.value
                          ? "border-emerald-300 bg-emerald-300 text-emerald-950"
                          : "border-white/15 bg-white/5 text-white hover:bg-white/10",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <Button
                  className="mt-4 w-full rounded-xl bg-emerald-300 text-emerald-950 hover:bg-emerald-200"
                  loading={working}
                  onClick={completeSession}
                >
                  <CheckCircle2 className="size-4" />
                  সেশন সম্পন্ন করুন
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          <UsersRound className="size-5 shrink-0 text-emerald-700" />
          {status.activeClassmates > 1
            ? `আপনিসহ ${status.activeClassmates} জন সহপাঠী এখন ফোকাস করছে`
            : "আপনি এখন আপনার ক্লাসের ফোকাস যাত্রা শুরু করেছেন"}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10"
        />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            <TimerReset className="size-4" />
            ফোকাস স্টুডিও
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-4xl">
            কম সময়ে মনোযোগ দিয়ে শিখুন
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
            একটি বিষয়, একটি লক্ষ্য, একটি টাইমার। সেশন শেষ করলে XP পাবেন এবং
            আপনার শেখার ধারাবাহিকতাও বাড়বে।
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold">
            <UsersRound className="size-4 text-emerald-200" />
            {status.activeClassmates > 0
              ? `${status.activeClassmates} জন সহপাঠী এখন ফোকাস করছে`
              : "প্রথম সেশনটি আপনিই শুরু করুন"}
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          {notice}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-800">
              আজকের ফোকাস
            </span>
            <Clock3 className="size-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-primary">
            {status.totals.todayMinutes} মিনিট
          </p>
          <p className="mt-1 text-xs text-muted">আজ সম্পন্ন করা সময়</p>
        </article>

        <article className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-orange-800">
              ফোকাস স্ট্রিক
            </span>
            <Flame className="size-5 text-orange-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-primary">
            {status.totals.focusStreak} দিন
          </p>
          <p className="mt-1 text-xs text-muted">
            প্রতিদিন একটি সেশনেই স্ট্রিক চলবে
          </p>
        </article>

        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-cyan-800">
              সাপ্তাহিক লক্ষ্য
            </span>
            <Target className="size-5 text-cyan-700" />
          </div>
          <p className="mt-2 text-2xl font-black text-primary">
            {status.totals.weekMinutes}/{status.totals.weeklyGoalMinutes} মিনিট
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-cyan-100">
            <div
              className="h-full rounded-full bg-cyan-600 transition-[width]"
              style={{ width: `${status.totals.weeklyPercent}%` }}
            />
          </div>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <Brain className="size-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
                নতুন সেশন
              </p>
              <h2 className="mt-1 text-xl font-black text-primary">
                আজ কী নিয়ে ফোকাস করবেন?
              </h2>
            </div>
          </div>

          <label
            htmlFor="focus-subject"
            className="mt-6 block text-sm font-black text-primary"
          >
            বিষয়
          </label>
          <select
            id="focus-subject"
            value={activeSubject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm font-bold text-primary outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            {status.subjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <fieldset className="mt-5">
            <legend className="text-sm font-black text-primary">লক্ষ্য</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {status.intentions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setIntention(item.value)}
                  aria-pressed={intention === item.value}
                  className={cn(
                    "min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
                    intention === item.value
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/15"
                      : "border-border bg-surface text-muted hover:border-emerald-300 hover:text-primary",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-black text-primary">সময়</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {status.durations.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDurationMinutes(minutes)}
                  aria-pressed={durationMinutes === minutes}
                  className={cn(
                    "min-h-14 rounded-xl border px-2 py-3 text-center transition",
                    durationMinutes === minutes
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-border bg-surface text-primary hover:border-emerald-300",
                  )}
                >
                  <span className="block text-lg font-black">{minutes}</span>
                  <span className="block text-2xs font-bold opacity-75">
                    মিনিট
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <Button
            className="mt-6 min-h-12 w-full rounded-xl bg-emerald-700 hover:bg-emerald-800"
            loading={working}
            disabled={!activeSubject}
            onClick={startSession}
          >
            <Play className="size-4 fill-current" />
            ফোকাস সেশন শুরু করুন
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-muted">
            সম্পন্ন মিনিট অনুযায়ী দিনে সর্বোচ্চ ৬০ XP পাওয়া যাবে।
          </p>
        </article>

        <div className="space-y-5">
          <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-cyan-700" />
              <h2 className="font-black text-primary">এই সপ্তাহ</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/70 p-3">
                <p className="text-2xl font-black text-primary">
                  {status.totals.completedSessions}
                </p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  সম্পন্ন সেশন
                </p>
              </div>
              <div className="rounded-xl bg-secondary/70 p-3">
                <p className="text-2xl font-black text-primary">
                  {recentTotal}
                </p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  সাম্প্রতিক মিনিট
                </p>
              </div>
            </div>
            {status.totals.weeklyPercent >= 100 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
                <Sparkles className="size-4 shrink-0 text-amber-600" />
                সাপ্তাহিক ১০০ মিনিটের লক্ষ্য পূর্ণ!
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <h2 className="font-black text-primary">সাম্প্রতিক সেশন</h2>
            {status.recentSessions.length === 0 ? (
              <div className="mt-4 rounded-xl bg-secondary/60 p-4 text-center">
                <TimerReset className="mx-auto size-7 text-muted" />
                <p className="mt-2 text-sm font-semibold text-muted">
                  প্রথম সেশন শেষ হলে এখানে দেখা যাবে।
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {status.recentSessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-primary">
                        {session.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDate(session.dateKey)} · {session.intentionLabel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-emerald-700">
                        {session.durationMinutes} মিনিট
                      </p>
                      <p className="text-2xs font-bold text-muted">
                        +{session.xpEarned} XP
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
