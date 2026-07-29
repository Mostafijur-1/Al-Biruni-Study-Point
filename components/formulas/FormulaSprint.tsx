"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  Flame,
  Layers3,
  RotateCcw,
  Sigma,
  Sparkles,
  Target,
  Trophy,
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

type Confidence = "again" | "good" | "easy";

type FormulaCard = {
  id: string;
  subject: string;
  topic: string;
  prompt: string;
  formula: string;
  explanation: string;
  example: string;
};

type FormulaAttempt = {
  id: string;
  dateKey: string;
  cards: FormulaCard[];
  answers: Array<{ cardId: string; confidence: Confidence }>;
  status: "started" | "completed";
  xpEarned: number;
  confidencePercent: number;
  startedAt: string;
  completedAt: string | null;
};

type FormulaStatus = {
  level: "SSC" | "HSC";
  today: FormulaAttempt | null;
  canStart: boolean;
  availableCards: number;
  stats: {
    completedSessions: number;
    formulaStreak: number;
    reviewedCards: number;
    confidencePercent: number;
  };
  recent: Array<{
    dateKey: string;
    xpEarned: number;
    confidencePercent: number;
  }>;
};

type StartResponse = {
  ok: true;
  alreadyStarted: boolean;
  attempt: FormulaAttempt;
};

type SubmitResponse = {
  ok: true;
  alreadyCompleted: boolean;
  attempt: FormulaAttempt;
  reward: {
    xp: number;
    breakdown?: {
      completion: number;
      recalled: number;
      confident: number;
    };
  };
  formulaStreak?: number;
};

const confidenceOptions = [
  {
    value: "again" as const,
    label: "আবার দেখব",
    description: "এটি আবার অনুশীলনে আগে আসবে",
    icon: RotateCcw,
    tone: "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
  },
  {
    value: "good" as const,
    label: "মনে আছে",
    description: "ভালোভাবে মনে করতে পেরেছি",
    icon: CheckCircle2,
    tone: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
  },
  {
    value: "easy" as const,
    label: "খুব সহজ",
    description: "একদম আত্মবিশ্বাসী",
    icon: Zap,
    tone:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },
];

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${dateKey}T12:00:00+06:00`));
}

export function FormulaSprint() {
  const [status, setStatus] = useState<FormulaStatus | null>(null);
  const [attempt, setAttempt] = useState<FormulaAttempt | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<
    Array<{ cardId: string; confidence: Confidence }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const viewTracked = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<FormulaStatus>("/api/formulas");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        const data = result.payload.data;
        setStatus(data);
        setAttempt(data.today);
      } else {
        setError(
          getApiErrorMessage(
            result.payload,
            "ফর্মুলা স্প্রিন্ট লোড করা যায়নি। আবার চেষ্টা করুন।",
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
      trackStudentEvent("student_formula_sprint_viewed", "formula_sprint", {
        has_attempt: Boolean(status?.today),
        completed_today: status?.today?.status === "completed",
      });
    }
  }, [loading, status]);

  async function startSprint() {
    setWorking(true);
    setError("");
    setMessage("");
    const result = await apiFetch<StartResponse>("/api/formulas/start", {
      method: "POST",
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const data = result.payload.data;
      setAttempt(data.attempt);
      setStatus((previous) =>
        previous
          ? { ...previous, today: data.attempt, canStart: false }
          : previous,
      );
      setCardIndex(0);
      setRevealed(false);
      setAnswers([]);
      trackStudentEvent("student_formula_sprint_started", "formula_sprint", {
        level: status?.level ?? "unknown",
        card_count: data.attempt.cards.length,
      });
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "আজকের স্প্রিন্ট শুরু করা যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  async function rateCard(confidence: Confidence) {
    if (!attempt) return;
    const currentCard = attempt.cards[cardIndex];
    if (!currentCard) return;
    const nextAnswers = [
      ...answers.filter((answer) => answer.cardId !== currentCard.id),
      { cardId: currentCard.id, confidence },
    ];
    setAnswers(nextAnswers);

    if (cardIndex < attempt.cards.length - 1) {
      setCardIndex((current) => current + 1);
      setRevealed(false);
      return;
    }

    setWorking(true);
    setError("");
    const result = await apiFetch<SubmitResponse>("/api/formulas/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: attempt.id,
        answers: nextAnswers,
      }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const data = result.payload.data;
      setAttempt(data.attempt);
      const refreshed = await apiFetch<FormulaStatus>("/api/formulas");
      if (refreshed.ok && isApiSuccess(refreshed.payload)) {
        setStatus(refreshed.payload.data);
        setAttempt(refreshed.payload.data.today ?? data.attempt);
      }
      setMessage(`স্প্রিন্ট সম্পন্ন—আপনি +${data.reward.xp} XP পেয়েছেন।`);
      trackStudentEvent("student_formula_sprint_completed", "formula_sprint", {
        confidence_percent: data.attempt.confidencePercent,
        xp_earned: data.reward.xp,
        formula_streak:
          data.formulaStreak ?? status?.stats.formulaStreak ?? 0,
      });
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "স্প্রিন্ট জমা দেওয়া যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="ফর্মুলা স্প্রিন্ট লোড হচ্ছে">
        <div className="h-52 animate-pulse rounded-3xl bg-indigo-100" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-secondary/70"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-secondary/70" />
      </div>
    );
  }

  if (!status) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <Sigma className="mx-auto size-9 text-red-600" />
        <h1 className="mt-3 text-xl font-black text-primary">
          ফর্মুলা স্প্রিন্ট খোলা যায়নি
        </h1>
        <p className="mt-2 text-sm text-red-800">{error}</p>
      </section>
    );
  }

  if (attempt?.status === "started") {
    const card = attempt.cards[cardIndex];
    const progress = Math.round((cardIndex / attempt.cards.length) * 100);
    if (!card) return null;

    return (
      <section className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-700">
              আজকের ফর্মুলা স্প্রিন্ট
            </p>
            <h1 className="mt-1 text-xl font-black text-primary">
              কার্ড {cardIndex + 1} / {attempt.cards.length}
            </h1>
          </div>
          <span className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-black text-indigo-800">
            {status.level}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
          >
            {error}
          </div>
        )}

        <article className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-card shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-indigo-50/70 px-5 py-4 sm:px-7">
            <span className="rounded-full bg-indigo-700 px-3 py-1.5 text-xs font-black text-white">
              {card.subject}
            </span>
            <span className="text-xs font-bold text-muted">{card.topic}</span>
          </div>

          <div className="min-h-[380px] p-5 sm:p-8">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="flex min-h-[330px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 text-center transition hover:border-indigo-400"
              >
                <Brain className="size-10 text-indigo-600" />
                <p className="mt-5 max-w-xl text-xl font-black leading-8 text-primary sm:text-2xl">
                  {card.prompt}
                </p>
                <span className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground">
                  <Eye className="size-4" />
                  উত্তর দেখুন
                </span>
                <span className="mt-3 text-xs font-semibold text-muted">
                  আগে মনে মনে উত্তরটি বলার চেষ্টা করুন
                </span>
              </button>
            ) : (
              <div className="min-h-[330px]">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-700 to-violet-800 p-6 text-center text-white sm:p-8">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
                    মূল সূত্র
                  </p>
                  <p className="mt-4 text-2xl font-black leading-9 sm:text-3xl">
                    {card.formula}
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-sky-800">
                      বুঝে রাখুন
                    </p>
                    <p className="mt-2 text-sm leading-6 text-sky-950">
                      {card.explanation}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      ছোট উদাহরণ
                    </p>
                    <p className="mt-2 text-sm leading-6 text-emerald-950">
                      {card.example}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </article>

        {revealed && (
          <div>
            <p className="mb-3 text-center text-sm font-black text-primary">
              কতটা মনে ছিল?
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {confidenceOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={working}
                    onClick={() => void rateCard(option.value)}
                    className={cn(
                      "min-h-20 rounded-xl border p-3 text-left transition disabled:cursor-wait disabled:opacity-60",
                      option.tone,
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-black">
                      <Icon className="size-4" />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-2xs font-semibold opacity-80">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-800 via-violet-800 to-fuchsia-800 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
              <Sigma className="size-5" />
              দৈনিক ফর্মুলা স্প্রিন্ট
            </div>
            <h1 className="mt-3 text-2xl font-black sm:text-4xl">
              পাঁচ কার্ডে সূত্র ঝালাই
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              আগে মনে করার চেষ্টা করুন, তারপর উত্তর উল্টে দেখুন। আপনার
              আত্মবিশ্বাস অনুযায়ী আগামী দিনের কার্ড নিজে থেকেই সাজবে।
            </p>
          </div>
          <div className="grid min-w-48 grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-center">
              <p className="text-2xl font-black">{status.availableCards}</p>
              <p className="text-2xs font-bold text-white/65">ফর্মুলা কার্ড</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-center">
              <p className="text-2xl font-black">{status.level}</p>
              <p className="text-2xs font-bold text-white/65">আপনার লেভেল</p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          {message}
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
        <StatCard
          icon={<Flame className="size-5" />}
          label="ফর্মুলা স্ট্রিক"
          value={`${status.stats.formulaStreak} দিন`}
          tone="border-orange-200 bg-orange-50/70 text-orange-800"
        />
        <StatCard
          icon={<Layers3 className="size-5" />}
          label="দেখা হয়েছে"
          value={`${status.stats.reviewedCards} কার্ড`}
          tone="border-sky-200 bg-sky-50/70 text-sky-800"
        />
        <StatCard
          icon={<Target className="size-5" />}
          label="আত্মবিশ্বাস"
          value={`${status.stats.confidencePercent}%`}
          tone="border-emerald-200 bg-emerald-50/70 text-emerald-800"
        />
      </div>

      {attempt?.status === "completed" ? (
        <CompletedSprint attempt={attempt} recent={status.recent} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-sm)] sm:p-8">
            <div className="mx-auto grid size-20 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Brain className="size-10" />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-widest text-indigo-700">
              আজকের মেমোরি ওয়ার্কআউট
            </p>
            <h2 className="mt-2 text-2xl font-black text-primary">
              ৫টি ছোট কার্ড, প্রায় ৩ মিনিট
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
              সূত্র দেখার আগে মনে করার চেষ্টা করুন। ভুল হলেও সমস্যা নেই—সেই
              কার্ডটিই আগামী স্প্রিন্টে বেশি গুরুত্ব পাবে।
            </p>
            <Button
              className="mt-6 min-h-12 rounded-xl bg-indigo-700 px-6 hover:bg-indigo-800"
              loading={working}
              onClick={startSprint}
            >
              আজকের স্প্রিন্ট শুরু করুন
              <ArrowRight className="size-4" />
            </Button>
          </article>

          <RecentSprints recent={status.recent} />
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className={cn("rounded-2xl border p-4", tone)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-black">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black text-primary">{value}</p>
    </article>
  );
}

function CompletedSprint({
  attempt,
  recent,
}: {
  attempt: FormulaAttempt;
  recent: FormulaStatus["recent"];
}) {
  const again = attempt.answers.filter(
    (answer) => answer.confidence === "again",
  ).length;
  const remembered = attempt.answers.length - again;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <div className="text-center">
          <Trophy className="mx-auto size-12 text-amber-500" />
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-indigo-700">
            আজকের স্প্রিন্ট সম্পন্ন
          </p>
          <h2 className="mt-2 text-3xl font-black text-primary">
            {attempt.confidencePercent}% আত্মবিশ্বাস
          </h2>
          <p className="mt-2 text-sm font-semibold text-muted">
            {remembered}টি মনে ছিল · {again}টি আবার অনুশীলনে আসবে · +
            {attempt.xpEarned} XP
          </p>
        </div>

        <div className="mt-6 grid gap-2">
          {attempt.cards.map((card) => {
            const confidence = attempt.answers.find(
              (answer) => answer.cardId === card.id,
            )?.confidence;
            return (
              <div
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white/80 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-primary">
                    {card.formula}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {card.subject} · {card.topic}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-2xs font-black",
                    confidence === "easy"
                      ? "bg-emerald-100 text-emerald-800"
                      : confidence === "good"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-orange-100 text-orange-800",
                  )}
                >
                  {confidence === "easy"
                    ? "খুব সহজ"
                    : confidence === "good"
                      ? "মনে আছে"
                      : "আবার দেখব"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-center text-xs font-semibold text-muted">
          আগামীকাল নতুন পাঁচটি অভিযোজিত কার্ড প্রস্তুত হবে।
        </p>
      </article>

      <RecentSprints recent={recent} />
    </div>
  );
}

function RecentSprints({ recent }: { recent: FormulaStatus["recent"] }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-violet-600" />
        <h2 className="font-black text-primary">সাম্প্রতিক স্প্রিন্ট</h2>
      </div>
      {recent.length === 0 ? (
        <div className="mt-4 rounded-xl bg-secondary/60 p-5 text-center">
          <Sigma className="mx-auto size-7 text-muted" />
          <p className="mt-2 text-sm font-semibold text-muted">
            প্রথম স্প্রিন্ট শেষ হলে ইতিহাস এখানে দেখা যাবে।
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {recent.map((item) => (
            <div
              key={item.dateKey}
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3"
            >
              <div>
                <p className="text-sm font-black text-primary">
                  {formatDate(item.dateKey)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  আত্মবিশ্বাস {item.confidencePercent}%
                </p>
              </div>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-800">
                +{item.xpEarned} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
