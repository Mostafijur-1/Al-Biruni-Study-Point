"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock3,
  CloudSun,
  Compass,
  Flame,
  FlaskConical,
  Gauge,
  RotateCcw,
  Sparkles,
  Target,
  TimerReset,
  WandSparkles,
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

type CoachMinutes = 5 | 15 | 30 | 45;
type CoachEnergy = "low" | "steady" | "high";
type CoachIntent =
  | "auto"
  | "revise"
  | "practice"
  | "focus"
  | "explore";

type CoachCheckIn = {
  id: string;
  dateKey: string;
  availableMinutes: CoachMinutes;
  energy: CoachEnergy;
  intent: CoachIntent;
  recommendation: {
    key: string;
    title: string;
    reason: string;
    href: string;
    estimatedMinutes: number;
    category: Exclude<CoachIntent, "auto">;
    accent: "orange" | "indigo" | "violet" | "emerald" | "cyan";
  };
  launchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CoachSignalsSummary = {
  dueMistakes: number;
  challengePending: boolean;
  formulaPending: boolean;
  weeklyGoal: {
    title: string;
    remaining: number;
    unit: string;
  } | null;
  weakChapter: {
    subject: string;
    chapter: string;
    score: number;
  } | null;
  labsRemaining: number;
};

type CoachStatus = {
  dateKey: string;
  current: CoachCheckIn | null;
  signals: CoachSignalsSummary;
};

type CheckInResponse = {
  checkIn: CoachCheckIn;
};

type LaunchResponse = {
  href: string;
  checkIn: CoachCheckIn;
};

const energyOptions = [
  {
    value: "low" as const,
    label: "হালকা শক্তি",
    description: "সহজ ও ছোট কাজ চাই",
    icon: CloudSun,
  },
  {
    value: "steady" as const,
    label: "স্বাভাবিক",
    description: "নিয়মিত কাজের জন্য প্রস্তুত",
    icon: Gauge,
  },
  {
    value: "high" as const,
    label: "দারুণ শক্তি",
    description: "চ্যালেঞ্জ নিতে প্রস্তুত",
    icon: Zap,
  },
];

const intentOptions = [
  {
    value: "auto" as const,
    label: "কোচ ঠিক করুক",
    icon: WandSparkles,
  },
  { value: "revise" as const, label: "রিভিশন", icon: RotateCcw },
  { value: "practice" as const, label: "অনুশীলন", icon: Brain },
  { value: "focus" as const, label: "গভীর ফোকাস", icon: TimerReset },
  { value: "explore" as const, label: "নতুন কিছু", icon: FlaskConical },
];

const accentClasses = {
  orange: {
    panel: "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50",
    icon: "bg-orange-100 text-orange-700",
    eyebrow: "text-orange-700",
    button: "bg-orange-700 hover:bg-orange-800",
  },
  indigo: {
    panel: "border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50",
    icon: "bg-indigo-100 text-indigo-700",
    eyebrow: "text-indigo-700",
    button: "bg-indigo-700 hover:bg-indigo-800",
  },
  violet: {
    panel: "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50",
    icon: "bg-violet-100 text-violet-700",
    eyebrow: "text-violet-700",
    button: "bg-violet-700 hover:bg-violet-800",
  },
  emerald: {
    panel: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50",
    icon: "bg-emerald-100 text-emerald-700",
    eyebrow: "text-emerald-700",
    button: "bg-emerald-700 hover:bg-emerald-800",
  },
  cyan: {
    panel: "border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50",
    icon: "bg-cyan-100 text-cyan-700",
    eyebrow: "text-cyan-700",
    button: "bg-cyan-700 hover:bg-cyan-800",
  },
};

export function SmartStudyCoach() {
  const router = useRouter();
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [availableMinutes, setAvailableMinutes] =
    useState<CoachMinutes>(15);
  const [energy, setEnergy] = useState<CoachEnergy>("steady");
  const [intent, setIntent] = useState<CoachIntent>("auto");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const viewTracked = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<CoachStatus>("/api/coach");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        setStatus(result.payload.data);
      } else {
        setError(
          getApiErrorMessage(
            result.payload,
            "স্টাডি কোচ লোড করা যায়নি। আবার চেষ্টা করো।",
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
      trackStudentEvent("student_study_coach_viewed", "study_coach", {
        has_recommendation: Boolean(status?.current),
        launched: Boolean(status?.current?.launchedAt),
      });
    }
  }, [loading, status]);

  async function createRecommendation() {
    setWorking(true);
    setError("");
    setMessage("");
    const result = await apiFetch<CheckInResponse>("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availableMinutes, energy, intent }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const checkIn = result.payload.data.checkIn;
      setStatus((previous) =>
        previous ? { ...previous, current: checkIn } : previous,
      );
      setEditing(false);
      setMessage("তোমার সময় ও অগ্রগতি দেখে আজকের সেরা পরবর্তী কাজটি সাজানো হয়েছে।");
      trackStudentEvent("student_coach_recommendation_created", "study_coach", {
        available_minutes: availableMinutes,
        energy,
        intent,
        recommendation: checkIn.recommendation.key,
      });
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "পরামর্শ তৈরি করা যায়নি। আবার চেষ্টা করো।",
        ),
      );
    }
    setWorking(false);
  }

  function editPreferences() {
    if (status?.current) {
      setAvailableMinutes(status.current.availableMinutes);
      setEnergy(status.current.energy);
      setIntent(status.current.intent);
    }
    setMessage("");
    setError("");
    setEditing(true);
  }

  async function launchRecommendation() {
    const checkIn = status?.current;
    if (!checkIn) return;
    setWorking(true);
    setError("");
    const result = await apiFetch<LaunchResponse>("/api/coach/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInId: checkIn.id }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const data = result.payload.data;
      trackStudentEvent("student_coach_recommendation_launched", "study_coach", {
        recommendation: checkIn.recommendation.key,
        destination: data.href,
      });
      router.push(data.href);
      return;
    }
    setError(
      getApiErrorMessage(
        result.payload,
        "প্রস্তাবিত কাজটি খোলা যায়নি। আবার চেষ্টা করো।",
      ),
    );
    setWorking(false);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="স্টাডি কোচ লোড হচ্ছে">
        <div className="h-52 animate-pulse rounded-3xl bg-blue-100" />
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
        <Compass className="mx-auto size-9 text-red-600" />
        <h1 className="mt-3 text-xl font-black text-primary">
          স্টাডি কোচ খোলা যায়নি
        </h1>
        <p className="mt-2 text-sm text-red-800">{error}</p>
      </section>
    );
  }

  const showPreferences = !status.current || editing;

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-800 via-indigo-800 to-violet-900 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10"
        />
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200">
            <Compass className="size-5" />
            স্মার্ট স্টাডি কোচ
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-4xl">
            এখন কী পড়বেন—সেটা আর ভাবতে হবে না
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
            তোমার সময়, শক্তি এবং বাস্তব শেখার অগ্রগতি মিলিয়ে সবচেয়ে কাজে লাগবে
            এমন একটি পরবর্তী পদক্ষেপ বেছে দেয়।
          </p>
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

      <ProgressSignals signals={status.signals} />

      {showPreferences ? (
        <CoachPreferences
          availableMinutes={availableMinutes}
          energy={energy}
          intent={intent}
          working={working}
          isEditing={Boolean(status.current)}
          onMinutes={setAvailableMinutes}
          onEnergy={setEnergy}
          onIntent={setIntent}
          onSubmit={createRecommendation}
          onCancel={() => setEditing(false)}
        />
      ) : status.current ? (
        <CoachRecommendationCard
          checkIn={status.current}
          working={working}
          onLaunch={launchRecommendation}
          onEdit={editPreferences}
        />
      ) : null}
    </section>
  );
}

function ProgressSignals({ signals }: { signals: CoachSignalsSummary }) {
  const dailyDone =
    Number(!signals.challengePending) + Number(!signals.formulaPending);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SignalCard
        icon={<RotateCcw className="size-5" />}
        label="রিভিশনের অপেক্ষায়"
        value={`${signals.dueMistakes}টি ভুল`}
        detail={
          signals.dueMistakes > 0
            ? "এখন দেখার সঠিক সময়"
            : "আজ কোনো বকেয়া ভুল নেই"
        }
        tone="border-orange-200 bg-orange-50/70 text-orange-800"
      />
      <SignalCard
        icon={<Flame className="size-5" />}
        label="দৈনিক ছোট কাজ"
        value={`${dailyDone}/2 সম্পন্ন`}
        detail="চ্যালেঞ্জ ও ফর্মুলা স্প্রিন্ট"
        tone="border-violet-200 bg-violet-50/70 text-violet-800"
      />
      <SignalCard
        icon={<Target className="size-5" />}
        label="সবচেয়ে দরকার"
        value={signals.weakChapter?.subject ?? signals.weeklyGoal?.title ?? "অনুশীলন"}
        detail={
          signals.weakChapter
            ? `${signals.weakChapter.chapter} · দক্ষতা ${signals.weakChapter.score}%`
            : signals.weeklyGoal
              ? `আর ${signals.weeklyGoal.remaining} ${signals.weeklyGoal.unit}`
              : "নিয়মিত শেখা ধরে রাখো"
        }
        tone="border-sky-200 bg-sky-50/70 text-sky-800"
      />
    </div>
  );
}

function SignalCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className={cn("rounded-2xl border p-4", tone)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-black">{label}</span>
        {icon}
      </div>
      <p className="mt-2 truncate text-xl font-black text-primary">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-muted">{detail}</p>
    </article>
  );
}

function CoachPreferences({
  availableMinutes,
  energy,
  intent,
  working,
  isEditing,
  onMinutes,
  onEnergy,
  onIntent,
  onSubmit,
  onCancel,
}: {
  availableMinutes: CoachMinutes;
  energy: CoachEnergy;
  intent: CoachIntent;
  working: boolean;
  isEditing: boolean;
  onMinutes: (value: CoachMinutes) => void;
  onEnergy: (value: CoachEnergy) => void;
  onIntent: (value: CoachIntent) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
          <Sparkles className="size-6" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-700">
            ছোট চেক-ইন
          </p>
          <h2 className="mt-1 text-xl font-black text-primary">
            আজকের অবস্থা বলো
          </h2>
          <p className="mt-1 text-sm text-muted">
            তিনটি উত্তরেই তোমার জন্য উপযুক্ত পরবর্তী কাজ সাজানো হবে।
          </p>
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="flex items-center gap-2 text-sm font-black text-primary">
          <Clock3 className="size-4 text-blue-700" />
          কত মিনিট সময় আছে?
        </legend>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {([5, 15, 30, 45] as const).map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onMinutes(minutes)}
              aria-pressed={availableMinutes === minutes}
              className={cn(
                "min-h-14 rounded-xl border px-2 py-3 text-center transition",
                availableMinutes === minutes
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-border bg-surface text-primary hover:border-blue-300",
              )}
            >
              <span className="block text-lg font-black">{minutes}</span>
              <span className="text-2xs font-bold opacity-75">মিনিট</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-black text-primary">
          এখন শক্তি কেমন?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {energyOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onEnergy(option.value)}
                aria-pressed={energy === option.value}
                className={cn(
                  "min-h-24 rounded-xl border p-3 text-left transition",
                  energy === option.value
                    ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/15"
                    : "border-border bg-surface hover:border-indigo-300",
                )}
              >
                <Icon
                  className={cn(
                    "size-5",
                    energy === option.value ? "text-indigo-700" : "text-muted",
                  )}
                />
                <span className="mt-2 block text-sm font-black text-primary">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-2xs font-semibold text-muted">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-black text-primary">
          কী ধরনের কাজ করতে চান?
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {intentOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onIntent(option.value)}
                aria-pressed={intent === option.value}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition",
                  intent === option.value
                    ? "border-violet-700 bg-violet-700 text-white"
                    : "border-border bg-surface text-primary hover:border-violet-300",
                )}
              >
                <Icon className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-7 flex flex-wrap justify-end gap-2">
        {isEditing && (
          <Button variant="outline" className="rounded-xl" onClick={onCancel}>
            আগের পরামর্শ রাখো
          </Button>
        )}
        <Button
          className="rounded-xl bg-blue-700 hover:bg-blue-800"
          loading={working}
          onClick={onSubmit}
        >
          <Compass className="size-4" />
          আমার পরবর্তী কাজ সাজান
        </Button>
      </div>
    </article>
  );
}

function CoachRecommendationCard({
  checkIn,
  working,
  onLaunch,
  onEdit,
}: {
  checkIn: CoachCheckIn;
  working: boolean;
  onLaunch: () => void;
  onEdit: () => void;
}) {
  const tone = accentClasses[checkIn.recommendation.accent];
  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl border shadow-[var(--shadow-sm)]",
        tone.panel,
      )}
    >
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl",
                tone.icon,
              )}
            >
              <Compass className="size-6" />
            </span>
            <div>
              <p
                className={cn(
                  "text-xs font-black uppercase tracking-widest",
                  tone.eyebrow,
                )}
              >
                কোচের আজকের পছন্দ
              </p>
              <h2 className="mt-1 text-2xl font-black text-primary">
                {checkIn.recommendation.title}
              </h2>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-primary/75">
            {checkIn.recommendation.reason}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-current/10 bg-white/60 px-3 py-1.5 text-xs font-black text-primary">
              <Clock3 className="mr-1.5 inline size-4" />
              প্রায় {checkIn.recommendation.estimatedMinutes} মিনিট
            </span>
            <span className="rounded-full border border-current/10 bg-white/60 px-3 py-1.5 text-xs font-black text-primary">
              <Brain className="mr-1.5 inline size-4" />
              তোমার অগ্রগতি অনুযায়ী
            </span>
            {checkIn.launchedAt && (
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                <CheckCircle2 className="mr-1.5 inline size-4" />
                আজ একবার শুরু করেছ
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-48 flex-col gap-2">
          <Button
            className={cn("min-h-12 rounded-xl", tone.button)}
            loading={working}
            onClick={onLaunch}
          >
            এই কাজ শুরু করো
            <ArrowRight className="size-4" />
          </Button>
          <Button variant="outline" className="rounded-xl bg-white/60" onClick={onEdit}>
            পছন্দ বদলে সাজান
          </Button>
        </div>
      </div>
    </article>
  );
}
