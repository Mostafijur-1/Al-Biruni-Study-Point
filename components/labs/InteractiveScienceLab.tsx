"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Atom,
  BatteryCharging,
  Beaker,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Play,
  RotateCcw,
  Sparkles,
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

type LabId = "motion" | "circuit" | "mole";

type LabSummary = {
  id: LabId;
  title: string;
  subject: string;
  description: string;
  challenge: string;
  target: number;
  unit: string;
  xp: number;
  completed: boolean;
  completedAt: string | null;
  xpEarned: number;
};

type LabHub = {
  labs: LabSummary[];
  progress: {
    completed: number;
    total: number;
    percent: number;
    xpEarned: number;
  };
};

type CompletionResponse = {
  ok: true;
  alreadyCompleted: boolean;
  reward: { xp: number };
  hub: LabHub;
};

const labIcons = {
  motion: Gauge,
  circuit: BatteryCharging,
  mole: Beaker,
} satisfies Record<LabId, typeof Gauge>;

const labTones = {
  motion: {
    selected: "border-sky-500 bg-sky-50 ring-sky-500/15",
    icon: "bg-sky-100 text-sky-700",
    accent: "text-sky-700",
    button: "bg-sky-700 hover:bg-sky-800",
  },
  circuit: {
    selected: "border-amber-500 bg-amber-50 ring-amber-500/15",
    icon: "bg-amber-100 text-amber-700",
    accent: "text-amber-700",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  mole: {
    selected: "border-violet-500 bg-violet-50 ring-violet-500/15",
    icon: "bg-violet-100 text-violet-700",
    accent: "text-violet-700",
    button: "bg-violet-700 hover:bg-violet-800",
  },
} satisfies Record<
  LabId,
  { selected: string; icon: string; accent: string; button: string }
>;

export function InteractiveScienceLab() {
  const [hub, setHub] = useState<LabHub | null>(null);
  const [activeLab, setActiveLab] = useState<LabId>("motion");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [motion, setMotion] = useState({ velocity: 10, time: 4 });
  const [circuit, setCircuit] = useState({ voltage: 9, resistance: 6 });
  const [mole, setMole] = useState({ moles: 1, molarMass: 18 });
  const viewTracked = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<LabHub>("/api/labs");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        setHub(result.payload.data);
      } else {
        setError(
          getApiErrorMessage(
            result.payload,
            "ইন্টার‌্যাক্টিভ ল্যাব লোড করা যায়নি। আবার চেষ্টা করুন।",
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
      trackStudentEvent("student_science_lab_viewed", "science_lab", {
        completed_labs: hub?.progress.completed ?? 0,
      });
    }
  }, [hub, loading]);

  const selected = hub?.labs.find((lab) => lab.id === activeLab);
  const experimentResult = useMemo(() => {
    if (activeLab === "motion") {
      return motion.velocity * motion.time;
    }
    if (activeLab === "circuit") {
      return circuit.voltage / circuit.resistance;
    }
    return mole.moles * mole.molarMass;
  }, [activeLab, circuit, mole, motion]);

  const meetsTarget = selected
    ? Math.abs(experimentResult - selected.target) < 0.001 &&
      (activeLab !== "mole" || mole.molarMass === 18)
    : false;

  function selectLab(labId: LabId) {
    setActiveLab(labId);
    setError("");
    setMessage("");
    trackStudentEvent("student_science_lab_opened", "science_lab", {
      lab_id: labId,
    });
  }

  async function completeLab() {
    if (!selected) return;
    if (!meetsTarget) {
      setError(
        activeLab === "mole"
          ? "পানি বেছে নিয়ে মোলের মান বদলান—লক্ষ্য ৩৬ গ্রাম।"
          : `আরও একটু পরীক্ষা করুন—লক্ষ্য ${selected.target} ${selected.unit}।`,
      );
      setMessage("");
      return;
    }

    const values =
      activeLab === "motion"
        ? motion
        : activeLab === "circuit"
          ? circuit
          : mole;
    setWorking(true);
    setError("");
    setMessage("");
    const result = await apiFetch<CompletionResponse>("/api/labs/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labId: activeLab, values }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      const data = result.payload.data;
      setHub(data.hub);
      setMessage(
        data.alreadyCompleted
          ? "এই ল্যাবের মাস্টারি আগেই সম্পন্ন হয়েছে—নতুন মান নিয়ে আরও পরীক্ষা করুন।"
          : `মাস্টারি সম্পন্ন! আপনার অ্যাকাউন্টে +${data.reward.xp} XP যোগ হয়েছে।`,
      );
      trackStudentEvent("student_science_lab_completed", "science_lab", {
        lab_id: activeLab,
        result: Number(experimentResult.toFixed(2)),
        xp_earned: data.reward.xp,
      });
    } else {
      setError(
        getApiErrorMessage(
          result.payload,
          "পরীক্ষার ফলটি এখনো লক্ষ্য পূরণ করেনি। আবার চেষ্টা করুন।",
        ),
      );
    }
    setWorking(false);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="ইন্টার‌্যাক্টিভ ল্যাব লোড হচ্ছে">
        <div className="h-52 animate-pulse rounded-3xl bg-cyan-100" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl bg-secondary/70"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-secondary/70" />
      </div>
    );
  }

  if (!hub || !selected) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <FlaskConical className="mx-auto size-9 text-red-600" />
        <h1 className="mt-3 text-xl font-black text-primary">
          সায়েন্স ল্যাব খোলা যায়নি
        </h1>
        <p className="mt-2 text-sm text-red-800">{error}</p>
      </section>
    );
  }

  const ActiveIcon = labIcons[activeLab];
  const activeTone = labTones[activeLab];

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-800 via-blue-800 to-indigo-900 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden
          className="absolute -right-14 -top-20 size-56 rounded-full bg-cyan-300/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 right-1/3 size-52 rounded-full bg-violet-300/10"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              <FlaskConical className="size-4" />
              ইন্টার‌্যাক্টিভ সায়েন্স ল্যাব
            </div>
            <h1 className="mt-3 text-2xl font-black sm:text-4xl">
              সূত্র শুধু পড়বেন না—পরীক্ষা করে দেখুন
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              মান বদলান, ফলাফল দেখুন এবং মাস্টারি চ্যালেঞ্জ সমাধান করে XP
              অর্জন করুন।
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-full bg-cyan-300 text-2xl font-black text-blue-950">
                {hub.progress.completed}/{hub.progress.total}
              </div>
              <div>
                <p className="text-sm font-black">ল্যাব মাস্টারি</p>
                <p className="mt-1 text-xs font-semibold text-white/65">
                  {hub.progress.xpEarned} XP অর্জিত
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-cyan-300"
                style={{ width: `${hub.progress.percent}%` }}
              />
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

      <div className="grid gap-3 sm:grid-cols-3" role="tablist" aria-label="সায়েন্স ল্যাব">
        {hub.labs.map((lab) => {
          const Icon = labIcons[lab.id];
          const selectedLab = lab.id === activeLab;
          const tone = labTones[lab.id];
          return (
            <button
              key={lab.id}
              type="button"
              role="tab"
              aria-selected={selectedLab}
              onClick={() => selectLab(lab.id)}
              className={cn(
                "relative min-h-32 rounded-2xl border bg-card p-4 text-left transition",
                selectedLab
                  ? cn("ring-2", tone.selected)
                  : "border-border hover:border-cyan-300 hover:bg-cyan-50/30",
              )}
            >
              {lab.completed && (
                <CheckCircle2 className="absolute right-3 top-3 size-5 text-emerald-600" />
              )}
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-xl",
                  tone.icon,
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="mt-3 block text-sm font-black text-primary">
                {lab.title}
              </span>
              <span className="mt-1 block text-xs font-semibold text-muted">
                {lab.subject} · +{lab.xp} XP
              </span>
            </button>
          );
        })}
      </div>

      <article
        role="tabpanel"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-sm)]"
      >
        <div className="border-b border-border px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-xl",
                  activeTone.icon,
                )}
              >
                <ActiveIcon className="size-6" />
              </span>
              <div>
                <p
                  className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    activeTone.accent,
                  )}
                >
                  {selected.subject}
                </p>
                <h2 className="mt-1 text-xl font-black text-primary">
                  {selected.title}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {selected.description}
                </p>
              </div>
            </div>
            {selected.completed && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                <Trophy className="size-4" /> মাস্টারি সম্পন্ন
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-h-[360px] bg-secondary/30 p-5 sm:p-7">
            {activeLab === "motion" ? (
              <MotionExperiment
                velocity={motion.velocity}
                time={motion.time}
                onChange={setMotion}
              />
            ) : activeLab === "circuit" ? (
              <CircuitExperiment
                voltage={circuit.voltage}
                resistance={circuit.resistance}
                onChange={setCircuit}
              />
            ) : (
              <MoleExperiment
                moles={mole.moles}
                molarMass={mole.molarMass}
                onChange={setMole}
              />
            )}
          </div>

          <div className="border-t border-border p-5 sm:p-7 lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-widest text-fuchsia-700">
              মাস্টারি চ্যালেঞ্জ
            </p>
            <h3 className="mt-2 text-lg font-black text-primary">
              {selected.challenge}
            </h3>
            <div
              className={cn(
                "mt-5 rounded-2xl border p-5 text-center",
                meetsTarget
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-border bg-secondary/60",
              )}
            >
              <p className="text-xs font-bold text-muted">আপনার ফলাফল</p>
              <p
                className={cn(
                  "mt-1 text-4xl font-black",
                  meetsTarget ? "text-emerald-700" : "text-primary",
                )}
              >
                {Number(experimentResult.toFixed(2))}
                <span className="ml-1 text-base text-muted">
                  {selected.unit}
                </span>
              </p>
              {meetsTarget && (
                <p className="mt-2 text-xs font-black text-emerald-800">
                  লক্ষ্য মিলেছে!
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-900">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-4 text-amber-600" />
                এককালীন পুরস্কার
              </span>
              <span>+{selected.xp} XP</span>
            </div>

            <Button
              className={cn("mt-5 min-h-12 w-full rounded-xl", activeTone.button)}
              loading={working}
              disabled={selected.completed}
              onClick={completeLab}
            >
              {selected.completed ? (
                <>
                  <CheckCircle2 className="size-4" /> মাস্টারি সম্পন্ন
                </>
              ) : (
                <>
                  <Zap className="size-4" /> ফলাফল যাচাই করুন
                </>
              )}
            </Button>
            <p className="mt-3 text-center text-xs leading-5 text-muted">
              মান যতবার ইচ্ছা বদলে পরীক্ষা করতে পারেন। XP প্রতিটি ল্যাবে একবারই
              পাওয়া যাবে।
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}

function LabValue({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-2xs font-black uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-primary">
        {value} <span className="text-xs text-muted">{unit}</span>
      </p>
    </div>
  );
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-black text-primary">
        <span>{label}</span>
        <span className="rounded-lg bg-primary px-2.5 py-1 text-xs text-primary-foreground">
          {value} {unit}
        </span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-primary"
      />
    </label>
  );
}

function ExperimentFrame({
  children,
  values,
}: {
  children: ReactNode;
  values: ReactNode;
}) {
  return (
    <div>
      {children}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{values}</div>
    </div>
  );
}

function MotionExperiment({
  velocity,
  time,
  onChange,
}: {
  velocity: number;
  time: number;
  onChange: (value: { velocity: number; time: number }) => void;
}) {
  const [ballPosition, setBallPosition] = useState(0);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const distance = velocity * time;
  const finalPosition = Math.min(100, (distance / 200) * 100);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function runExperiment() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setRunning(false);
    setBallPosition(0);
    const startTimer = window.setTimeout(() => {
      setRunning(true);
      setBallPosition(finalPosition);
    }, 30);
    const stopTimer = window.setTimeout(
      () => setRunning(false),
      Math.min(4_000, time * 400) + 80,
    );
    timers.current = [startTimer, stopTimer];
  }

  function resetExperiment() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setRunning(false);
    setBallPosition(0);
  }

  return (
    <ExperimentFrame
      values={
        <>
          <LabValue label="বেগ" value={velocity} unit="m/s" />
          <LabValue label="সময়" value={time} unit="s" />
          <LabValue label="সরণ" value={distance} unit="m" />
        </>
      }
    >
      <div
        role="img"
        aria-label={`বস্তুটি প্রতি সেকেন্ডে ${velocity} মিটার বেগে ${time} সেকেন্ডে ${distance} মিটার যায়`}
        className="relative h-44 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-100 to-sky-50"
      >
        <div className="absolute inset-x-0 bottom-7 h-1 bg-slate-500" />
        {[0, 25, 50, 75, 100].map((position) => (
          <div
            key={position}
            className="absolute bottom-3 h-5 w-px bg-slate-400"
            style={{ left: `${position}%` }}
          >
            <span className="absolute top-5 -translate-x-1/2 text-2xs font-bold text-slate-600">
              {position * 2}m
            </span>
          </div>
        ))}
        <div
          className="absolute bottom-8 size-7 -translate-x-1/2 rounded-full border-4 border-sky-900 bg-cyan-400 shadow-lg"
          style={{
            left: `${ballPosition}%`,
            transitionProperty: "left",
            transitionDuration: running ? `${Math.min(4_000, time * 400)}ms` : "0ms",
            transitionTimingFunction: "linear",
          }}
        >
          <span className="absolute inset-1 rounded-full border border-sky-900/30" />
        </div>
        <div className="absolute left-4 top-4 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-black text-sky-900">
          d = v × t
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <RangeControl
          id="motion-velocity"
          label="বেগ"
          value={velocity}
          min={2}
          max={20}
          unit="m/s"
          onChange={(next) => {
            resetExperiment();
            onChange({ velocity: next, time });
          }}
        />
        <RangeControl
          id="motion-time"
          label="সময়"
          value={time}
          min={1}
          max={10}
          unit="s"
          onChange={(next) => {
            resetExperiment();
            onChange({ velocity, time: next });
          }}
        />
        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={runExperiment}
        >
          {running ? (
            <RotateCcw className="size-4" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
          {running ? "আবার চালান" : "পরীক্ষা চালান"}
        </Button>
      </div>
    </ExperimentFrame>
  );
}

function CircuitExperiment({
  voltage,
  resistance,
  onChange,
}: {
  voltage: number;
  resistance: number;
  onChange: (value: { voltage: number; resistance: number }) => void;
}) {
  const current = voltage / resistance;
  const power = voltage * current;
  const glow = Math.min(1, current / 4);

  return (
    <ExperimentFrame
      values={
        <>
          <LabValue label="ভোল্টেজ" value={voltage} unit="V" />
          <LabValue label="কারেন্ট" value={current.toFixed(2)} unit="A" />
          <LabValue label="ক্ষমতা" value={power.toFixed(1)} unit="W" />
        </>
      }
    >
      <div
        role="img"
        aria-label={`${voltage} ভোল্ট এবং ${resistance} ওহমে কারেন্ট ${current.toFixed(2)} অ্যাম্পিয়ার`}
        className="relative h-52 overflow-hidden rounded-2xl border border-amber-200 bg-slate-900"
      >
        <div className="absolute inset-8 rounded-3xl border-4 border-amber-400/70" />
        <div className="absolute left-4 top-1/2 grid h-20 w-12 -translate-y-1/2 place-items-center rounded-lg border-2 border-slate-300 bg-slate-800 text-center text-xs font-black text-white">
          <span>
            +<br />
            {voltage}V
            <br />−
          </span>
        </div>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 rounded-lg border-2 border-orange-300 bg-orange-950 px-3 py-7 text-xs font-black text-orange-100">
          {resistance}Ω
        </div>
        <div
          className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-yellow-200 bg-yellow-300 text-center text-xs font-black text-yellow-950 shadow-[0_0_45px_rgba(250,204,21,0.7)]"
          style={{ opacity: 0.45 + glow * 0.55 }}
        >
          <Zap className="size-8 fill-current" />
          {current.toFixed(1)}A
        </div>
        {[20, 35, 50, 65, 80].map((position) => (
          <span
            key={position}
            aria-hidden
            className="absolute top-[26px] size-2 animate-pulse rounded-full bg-cyan-300"
            style={{
              left: `${position}%`,
              animationDuration: `${Math.max(0.4, 1.8 - current * 0.25)}s`,
            }}
          />
        ))}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black text-amber-100">
          I = V ÷ R
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <RangeControl
          id="circuit-voltage"
          label="ভোল্টেজ"
          value={voltage}
          min={3}
          max={24}
          unit="V"
          onChange={(next) => onChange({ voltage: next, resistance })}
        />
        <RangeControl
          id="circuit-resistance"
          label="রোধ"
          value={resistance}
          min={2}
          max={20}
          unit="Ω"
          onChange={(next) => onChange({ voltage, resistance: next })}
        />
      </div>
    </ExperimentFrame>
  );
}

function MoleExperiment({
  moles,
  molarMass,
  onChange,
}: {
  moles: number;
  molarMass: number;
  onChange: (value: { moles: number; molarMass: number }) => void;
}) {
  const mass = moles * molarMass;
  const fill = Math.min(88, Math.max(12, (mass / 292.5) * 88));
  const substances = [
    { value: 18, label: "পানি (H₂O)", color: "bg-sky-400" },
    { value: 44, label: "কার্বন ডাই-অক্সাইড (CO₂)", color: "bg-violet-400" },
    { value: 58.5, label: "সোডিয়াম ক্লোরাইড (NaCl)", color: "bg-emerald-400" },
  ];
  const selectedSubstance =
    substances.find((item) => item.value === molarMass) ?? substances[0];

  return (
    <ExperimentFrame
      values={
        <>
          <LabValue label="মোল" value={moles} unit="mol" />
          <LabValue label="মোলার ভর" value={molarMass} unit="g/mol" />
          <LabValue label="মোট ভর" value={mass} unit="g" />
        </>
      }
    >
      <div
        role="img"
        aria-label={`${moles} মোল ${selectedSubstance.label}-এর ভর ${mass} গ্রাম`}
        className="relative h-56 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white"
      >
        <div className="absolute left-4 top-4 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-900">
          m = n × M
        </div>
        <Atom className="absolute right-5 top-4 size-9 text-violet-300" />
        <div className="absolute bottom-5 left-1/2 h-40 w-36 -translate-x-1/2 overflow-hidden rounded-b-[42px] border-x-4 border-b-4 border-slate-400 bg-white/60">
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 transition-[height] duration-500",
              selectedSubstance.color,
            )}
            style={{ height: `${fill}%` }}
          >
            {[20, 42, 68].map((position, index) => (
              <span
                key={position}
                aria-hidden
                className="absolute size-3 rounded-full border border-white/60 bg-white/35"
                style={{
                  left: `${position}%`,
                  bottom: `${22 + index * 18}%`,
                }}
              />
            ))}
          </div>
          {[50, 100, 150, 200].map((mark) => (
            <span
              key={mark}
              className="absolute left-2 h-px w-4 bg-slate-500"
              style={{ bottom: `${(mark / 250) * 100}%` }}
            >
              <span className="absolute left-5 -top-2 text-2xs font-bold text-slate-600">
                {mark}g
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="mole-substance" className="text-sm font-black text-primary">
            পদার্থ
          </label>
          <select
            id="mole-substance"
            value={molarMass}
            onChange={(event) =>
              onChange({ moles, molarMass: Number(event.target.value) })
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-bold text-primary outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          >
            {substances.map((substance) => (
              <option key={substance.value} value={substance.value}>
                {substance.label} — {substance.value} g/mol
              </option>
            ))}
          </select>
        </div>
        <RangeControl
          id="mole-amount"
          label="পদার্থের পরিমাণ"
          value={moles}
          min={0.5}
          max={5}
          step={0.5}
          unit="mol"
          onChange={(next) => onChange({ moles: next, molarMass })}
        />
      </div>
    </ExperimentFrame>
  );
}
