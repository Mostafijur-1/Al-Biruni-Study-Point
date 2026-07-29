"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Flame,
  Gift,
  Sparkles,
  Swords,
  Target,
  TimerReset,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  apiFetch,
  getApiErrorMessage,
  isApiSuccess,
} from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

type GoalMetric =
  | "practice_questions"
  | "focus_minutes"
  | "challenge_days";

type GoalOption = {
  metric: GoalMetric;
  label: string;
  description: string;
  unit: string;
  href: string;
  supportsSubject: boolean;
  targets: Array<{ target: number; xp: number; label: string }>;
};

type GoalBoard = {
  period: {
    key: string;
    endKey: string;
    daysRemaining: number;
  };
  subjects: string[];
  options: GoalOption[];
  current: {
    id: string;
    metric: GoalMetric;
    label: string;
    description: string;
    unit: string;
    href: string;
    subject: string | null;
    target: number;
    rewardXp: number;
    status: "active" | "claimed";
    progress: number;
    rawProgress: number;
    percent: number;
    complete: boolean;
    claimed: boolean;
    isStretch: boolean;
    createdAt: string;
    claimedAt: string | null;
  } | null;
  activity: {
    days: Array<{
      dateKey: string;
      dayIndex: number;
      isToday: boolean;
      isFuture: boolean;
      practiceQuestions: number;
      focusMinutes: number;
      challengeCompleted: boolean;
      active: boolean;
    }>;
    totals: {
      practiceQuestions: number;
      focusMinutes: number;
      challengeDays: number;
      activeDays: number;
    };
  };
};

type CreateGoalResponse = {
  ok: true;
  alreadyCreated: boolean;
  board: GoalBoard;
};

type ClaimGoalResponse = {
  ok: true;
  alreadyClaimed: boolean;
  reward: { xp: number };
  board: GoalBoard;
};

const metricIcons = {
  practice_questions: Brain,
  focus_minutes: TimerReset,
  challenge_days: Swords,
} satisfies Record<GoalMetric, typeof Brain>;

const metricTones = {
  practice_questions: "border-sky-200 bg-sky-50 text-sky-800",
  focus_minutes: "border-emerald-200 bg-emerald-50 text-emerald-800",
  challenge_days: "border-violet-200 bg-violet-50 text-violet-800",
} satisfies Record<GoalMetric, string>;

function formatWeekday(dateKey: string) {
  return new Intl.DateTimeFormat("bn-BD", {
    weekday: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${dateKey}T12:00:00+06:00`));
}

function formatWeekRange(startKey: string, endKey: string) {
  const formatter = new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dhaka",
  });
  return `${formatter.format(new Date(`${startKey}T12:00:00+06:00`))} – ${formatter.format(
    new Date(`${endKey}T12:00:00+06:00`),
  )}`;
}

export function WeeklyGoalBoard() {
  const [board, setBoard] = useState<GoalBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [metric, setMetric] = useState<GoalMetric>("practice_questions");
  const [target, setTarget] = useState(30);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const viewTracked = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<GoalBoard>("/api/goals");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        setBoard(result.payload.data);
      } else {
        setError(
          getApiErrorMessage(
            result.payload,
            "সাপ্তাহিক লক্ষ্য লোড করা যায়নি। আবার চেষ্টা করুন।",
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
      trackStudentEvent("student_goal_board_viewed", "weekly_goal_board", {
        has_goal: Boolean(board?.current),
        goal_claimed: Boolean(board?.current?.claimed),
      });
    }
  }, [board, loading]);

  const selectedOption = board?.options.find(
    (option) => option.metric === metric,
  );
  const selectedTarget = selectedOption?.targets.find(
    (option) => option.target === target,
  );

  function chooseMetric(nextMetric: GoalMetric) {
    const option = board?.options.find((item) => item.metric === nextMetric);
    setMetric(nextMetric);
    setTarget(option?.targets[0]?.target ?? 1);
    if (!option?.supportsSubject) setSubject("");
  }

  async function createGoal() {
    if (!selectedOption || !selectedTarget) return;
    setWorking(true);
    setError("");
    setMessage("");
    const result = await apiFetch<CreateGoalResponse>("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metric,
        target,
        subject: selectedOption.supportsSubject && subject ? subject : undefined,
      }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const data = result.payload.data;
      setBoard(data.board);
      setMessage(
        data.alreadyCreated
          ? "এই সপ্তাহের লক্ষ্যটি আগেই তৈরি হয়েছে।"
          : "লক্ষ্য ঠিক হয়েছে—এখন প্রতিটি শেখার কাজ নিজে থেকেই যোগ হবে।",
      );
      trackStudentEvent("student_weekly_goal_created", "weekly_goal_board", {
        metric,
        target,
        subject: subject || "all",
      });
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "লক্ষ্য তৈরি করা যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  async function claimReward() {
    if (!board?.current?.complete) return;
    setWorking(true);
    setError("");
    setMessage("");
    const result = await apiFetch<ClaimGoalResponse>("/api/goals/claim", {
      method: "POST",
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const data = result.payload.data;
      setBoard(data.board);
      setMessage(`লক্ষ্য জয়! আপনার অ্যাকাউন্টে +${data.reward.xp} XP যোগ হয়েছে।`);
      trackStudentEvent("student_weekly_goal_claimed", "weekly_goal_board", {
        metric: board.current.metric,
        target: board.current.target,
        xp_earned: data.reward.xp,
      });
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "পুরস্কার সংগ্রহ করা যায়নি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="সাপ্তাহিক লক্ষ্য লোড হচ্ছে">
        <div className="h-52 animate-pulse rounded-3xl bg-rose-100" />
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

  if (!board) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <Target className="mx-auto size-9 text-red-600" />
        <h1 className="mt-3 text-xl font-black text-primary">
          লক্ষ্য বোর্ড খোলা যায়নি
        </h1>
        <p className="mt-2 text-sm text-red-800">{error}</p>
      </section>
    );
  }

  const goal = board.current;
  const GoalIcon = goal ? metricIcons[goal.metric] : Target;

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-700 via-fuchsia-700 to-violet-800 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10"
        />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-rose-200">
              <CalendarCheck className="size-4" />
              সাপ্তাহিক লক্ষ্য
            </div>
            <h1 className="mt-3 text-2xl font-black sm:text-4xl">
              নিজের লক্ষ্য, নিজের অগ্রযাত্রা
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              একটি বাস্তবসম্মত লক্ষ্য বেছে নিন। অনুশীলন, ফোকাস বা চ্যালেঞ্জ
              সম্পন্ন করলেই অগ্রগতি স্বয়ংক্রিয়ভাবে বাড়বে।
            </p>
          </div>
          <div className="flex gap-3 lg:flex-col lg:items-end">
            <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black">
              {formatWeekRange(board.period.key, board.period.endKey)}
            </span>
            <span className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-violet-950">
              আর {board.period.daysRemaining} দিন
            </span>
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
        <ActivityStat
          icon={<Brain className="size-5" />}
          label="অনুশীলন"
          value={`${board.activity.totals.practiceQuestions} প্রশ্ন`}
          tone="border-sky-200 bg-sky-50/70 text-sky-800"
        />
        <ActivityStat
          icon={<TimerReset className="size-5" />}
          label="ফোকাস"
          value={`${board.activity.totals.focusMinutes} মিনিট`}
          tone="border-emerald-200 bg-emerald-50/70 text-emerald-800"
        />
        <ActivityStat
          icon={<Swords className="size-5" />}
          label="ডেইলি চ্যালেঞ্জ"
          value={`${board.activity.totals.challengeDays} দিন`}
          tone="border-violet-200 bg-violet-50/70 text-violet-800"
        />
      </div>

      {goal ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-xl border",
                    metricTones[goal.metric],
                  )}
                >
                  <GoalIcon className="size-6" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-rose-700">
                    এই সপ্তাহের প্রতিশ্রুতি
                  </p>
                  <h2 className="mt-1 text-xl font-black text-primary">
                    {goal.subject ? `${goal.subject}: ` : ""}
                    {goal.target} {goal.unit}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{goal.description}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900">
                <Gift className="size-4" /> +{goal.rewardXp} XP
              </span>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
              <div
                className="mx-auto grid size-44 place-items-center rounded-full p-3"
                style={{
                  background: `conic-gradient(rgb(225 29 72) ${goal.percent * 3.6}deg, rgb(255 228 230) 0deg)`,
                }}
              >
                <div className="grid size-full place-items-center rounded-full bg-card text-center">
                  <div>
                    {goal.claimed ? (
                      <Trophy className="mx-auto size-10 text-amber-500" />
                    ) : (
                      <p className="text-4xl font-black text-primary">
                        {goal.percent}%
                      </p>
                    )}
                    <p className="mt-1 text-xs font-bold text-muted">
                      {goal.claimed ? "জয় সম্পন্ন" : "অগ্রগতি"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-muted">সম্পন্ন</p>
                    <p className="mt-1 text-3xl font-black text-primary">
                      {goal.progress}
                      <span className="ml-1 text-base text-muted">
                        / {goal.target} {goal.unit}
                      </span>
                    </p>
                  </div>
                  {goal.complete && !goal.claimed && (
                    <Sparkles className="size-8 text-amber-500" />
                  )}
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-rose-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-600 to-fuchsia-600 transition-[width]"
                    style={{ width: `${goal.percent}%` }}
                  />
                </div>

                {goal.claimed ? (
                  <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-black text-emerald-900">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    পুরস্কার সংগ্রহ হয়েছে। সোমবার নতুন লক্ষ্য খুলবে।
                  </div>
                ) : goal.complete ? (
                  <Button
                    className="mt-5 w-full rounded-xl bg-rose-700 hover:bg-rose-800"
                    loading={working}
                    onClick={claimReward}
                  >
                    <Gift className="size-4" />
                    +{goal.rewardXp} XP সংগ্রহ করুন
                  </Button>
                ) : (
                  <Link
                    href={goal.href}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary-hover"
                  >
                    পরের ধাপ শুরু করুন <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            </div>
          </article>

          <WeeklyRhythm board={board} />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
                <Target className="size-6" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-rose-700">
                  একটি লক্ষ্য বেছে নিন
                </p>
                <h2 className="mt-1 text-xl font-black text-primary">
                  এই সপ্তাহে কোন জয়টি চান?
                </h2>
              </div>
            </div>

            <fieldset className="mt-6">
              <legend className="sr-only">লক্ষ্যের ধরন</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {board.options.map((option) => {
                  const Icon = metricIcons[option.metric];
                  const selected = metric === option.metric;
                  return (
                    <button
                      key={option.metric}
                      type="button"
                      onClick={() => chooseMetric(option.metric)}
                      aria-pressed={selected}
                      className={cn(
                        "min-h-28 rounded-2xl border p-4 text-left transition",
                        selected
                          ? "border-rose-500 bg-rose-50 ring-2 ring-rose-500/15"
                          : "border-border bg-surface hover:border-rose-200",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-6",
                          selected ? "text-rose-700" : "text-muted",
                        )}
                      />
                      <span className="mt-3 block text-sm font-black text-primary">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {selectedOption?.supportsSubject && (
              <div className="mt-5">
                <label
                  htmlFor="weekly-goal-subject"
                  className="text-sm font-black text-primary"
                >
                  বিষয়
                </label>
                <select
                  id="weekly-goal-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm font-bold text-primary outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="">সব বিষয় মিলিয়ে</option>
                  {board.subjects.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <fieldset className="mt-5">
              <legend className="text-sm font-black text-primary">
                কঠিনতার মাত্রা
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {selectedOption?.targets.map((item) => (
                  <button
                    key={item.target}
                    type="button"
                    onClick={() => setTarget(item.target)}
                    aria-pressed={target === item.target}
                    className={cn(
                      "min-h-20 rounded-xl border px-2 py-3 text-center transition",
                      target === item.target
                        ? "border-rose-600 bg-rose-600 text-white shadow-sm"
                        : "border-border bg-surface text-primary hover:border-rose-300",
                    )}
                  >
                    <span className="block text-lg font-black">
                      {item.target} {selectedOption.unit}
                    </span>
                    <span className="mt-1 block text-2xs font-bold opacity-80">
                      {item.label} · +{item.xp} XP
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <Button
              className="mt-6 min-h-12 w-full rounded-xl bg-rose-700 hover:bg-rose-800"
              loading={working}
              disabled={!selectedOption || !selectedTarget}
              onClick={createGoal}
            >
              <Flame className="size-4" />
              এই লক্ষ্য নিন
            </Button>
            <p className="mt-3 text-center text-xs leading-5 text-muted">
              প্রতি সপ্তাহে একটি লক্ষ্য নেওয়া যায়। সোমবার নতুন লক্ষ্য বেছে নিতে
              পারবেন।
            </p>
          </article>

          <WeeklyRhythm board={board} />
        </div>
      )}
    </section>
  );
}

function ActivityStat({
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

function WeeklyRhythm({ board }: { board: GoalBoard }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-violet-700">
            শেখার ছন্দ
          </p>
          <h2 className="mt-1 text-lg font-black text-primary">সপ্তাহের পথচলা</h2>
        </div>
        <Clock3 className="size-6 text-violet-600" />
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {board.activity.days.map((day) => (
          <div key={day.dateKey} className="text-center">
            <p
              className={cn(
                "text-2xs font-black",
                day.isToday ? "text-rose-700" : "text-muted",
              )}
            >
              {formatWeekday(day.dateKey)}
            </p>
            <div
              title={
                day.active
                  ? `${day.practiceQuestions} প্রশ্ন, ${day.focusMinutes} ফোকাস মিনিট${day.challengeCompleted ? ", চ্যালেঞ্জ সম্পন্ন" : ""}`
                  : "কোনো কার্যক্রম নেই"
              }
              className={cn(
                "mx-auto mt-2 grid size-9 place-items-center rounded-xl border text-xs font-black",
                day.active
                  ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                  : day.isToday
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : day.isFuture
                      ? "border-border bg-secondary/40 text-muted/50"
                      : "border-border bg-secondary text-muted",
              )}
            >
              {day.active ? (
                <CheckCircle2 className="size-4" />
              ) : (
                day.dayIndex + 1
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-secondary/60 p-4">
        <p className="text-sm font-black text-primary">
          {board.activity.totals.activeDays} দিন সক্রিয়
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">
          অনুশীলন, ফোকাস সেশন বা ডেইলি চ্যালেঞ্জ—যেকোনো একটি সম্পন্ন হলেই দিনটি
          সক্রিয় হবে।
        </p>
      </div>
    </article>
  );
}
