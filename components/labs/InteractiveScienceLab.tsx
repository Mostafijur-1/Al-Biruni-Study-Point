"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Atom,
  BatteryCharging,
  Beaker,
  Binary,
  BookOpen,
  CheckCircle2,
  CircuitBoard,
  Cpu,
  FlaskConical,
  Gauge,
  Lightbulb,
  Microscope,
  Network,
  NotebookPen,
  Play,
  RotateCcw,
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
import { getTranslatedChapter } from "@/lib/content/syllabus";
import {
  calculateLabResult,
  getInitialLabValues,
  validateLabMastery,
  type LabControl,
  type LabInputValues,
  type ScienceLabId,
} from "@/lib/labs/rules";
import { cn } from "@/lib/utils";

type LabFamily = "physics" | "chemistry" | "math" | "ict";
type Prediction = "less" | "equal" | "more";

type LabSummary = {
  id: ScienceLabId;
  title: string;
  family: LabFamily;
  subject: string;
  chapter: string;
  description: string;
  challenge: string;
  formula: string;
  insight: string;
  target: number;
  tolerance: number;
  unit: string;
  resultLabel: string;
  xp: number;
  controls: LabControl[];
  completed: boolean;
  completedAt: string | null;
  xpEarned: number;
};

type LabHub = {
  level: "ssc" | "hsc";
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

const familyTheme = {
  physics: {
    label: "পদার্থবিজ্ঞান",
    icon: Gauge,
    card: "border-sky-200 bg-sky-50/60",
    active: "border-sky-500 bg-sky-50 ring-sky-500/15",
    iconStyle: "bg-sky-100 text-sky-700",
    accent: "text-sky-700",
    button: "bg-sky-700 hover:bg-sky-800",
    stage: "from-sky-950 via-blue-900 to-cyan-950",
  },
  chemistry: {
    label: "রসায়ন",
    icon: FlaskConical,
    card: "border-violet-200 bg-violet-50/60",
    active: "border-violet-500 bg-violet-50 ring-violet-500/15",
    iconStyle: "bg-violet-100 text-violet-700",
    accent: "text-violet-700",
    button: "bg-violet-700 hover:bg-violet-800",
    stage: "from-violet-950 via-fuchsia-900 to-indigo-950",
  },
  math: {
    label: "গণিত",
    icon: Target,
    card: "border-emerald-200 bg-emerald-50/60",
    active: "border-emerald-500 bg-emerald-50 ring-emerald-500/15",
    iconStyle: "bg-emerald-100 text-emerald-700",
    accent: "text-emerald-700",
    button: "bg-emerald-700 hover:bg-emerald-800",
    stage: "from-emerald-950 via-teal-900 to-cyan-950",
  },
  ict: {
    label: "আইসিটি",
    icon: Cpu,
    card: "border-amber-200 bg-amber-50/60",
    active: "border-amber-500 bg-amber-50 ring-amber-500/15",
    iconStyle: "bg-amber-100 text-amber-700",
    accent: "text-amber-700",
    button: "bg-amber-600 hover:bg-amber-700",
    stage: "from-slate-950 via-indigo-950 to-amber-950",
  },
} satisfies Record<
  LabFamily,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
    card: string;
    active: string;
    iconStyle: string;
    accent: string;
    button: string;
    stage: string;
  }
>;

const predictionLabels: Array<{ value: Prediction; label: string }> = [
  { value: "less", label: "লক্ষ্যের কম" },
  { value: "equal", label: "লক্ষ্যের সমান" },
  { value: "more", label: "লক্ষ্যের বেশি" },
];

export function InteractiveScienceLab() {
  const [hub, setHub] = useState<LabHub | null>(null);
  const [activeLabId, setActiveLabId] = useState<ScienceLabId>("motion");
  const [values, setValues] = useState<LabInputValues>(
    getInitialLabValues("motion"),
  );
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedChapter, setSelectedChapter] = useState("all");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [runVersion, setRunVersion] = useState(0);
  const [observations, setObservations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const viewTracked = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<LabHub>("/api/labs");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        const data = result.payload.data;
        setHub(data);
        const firstIncomplete =
          data.labs.find((lab) => !lab.completed) ?? data.labs[0];
        if (firstIncomplete) {
          setActiveLabId(firstIncomplete.id);
          setValues(getInitialLabValues(firstIncomplete.id));
        }
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
        available_labs: hub?.progress.total ?? 0,
      });
    }
  }, [hub, loading]);

  const selected = hub?.labs.find((lab) => lab.id === activeLabId) ?? null;
  const subjects = useMemo(
    () => [...new Set(hub?.labs.map((lab) => lab.subject) ?? [])],
    [hub],
  );
  const chapters = useMemo(
    () => [
      ...new Set(
        (hub?.labs ?? [])
          .filter(
            (lab) =>
              selectedSubject === "all" || lab.subject === selectedSubject,
          )
          .map((lab) => lab.chapter),
      ),
    ],
    [hub, selectedSubject],
  );
  const filteredLabs = useMemo(
    () =>
      (hub?.labs ?? []).filter(
        (lab) =>
          (selectedSubject === "all" || lab.subject === selectedSubject) &&
          (selectedChapter === "all" || lab.chapter === selectedChapter),
      ),
    [hub, selectedChapter, selectedSubject],
  );
  const result = selected ? calculateLabResult(selected.id, values) : 0;
  const mastery = selected
    ? validateLabMastery(selected.id, values)
    : { valid: false, result: 0 };
  const relation: Prediction = !selected
    ? "less"
    : result < selected.target - selected.tolerance
      ? "less"
      : result > selected.target + selected.tolerance
        ? "more"
        : "equal";

  function selectLab(labId: ScienceLabId) {
    setActiveLabId(labId);
    setValues(getInitialLabValues(labId));
    setPrediction(null);
    setHasRun(false);
    setObservations([]);
    setError("");
    setMessage("");
    trackStudentEvent("student_science_lab_opened", "science_lab", {
      lab_id: labId,
    });
  }

  function chooseSubject(subject: string) {
    setSelectedSubject(subject);
    setSelectedChapter("all");
    const first = hub?.labs.find(
      (lab) => subject === "all" || lab.subject === subject,
    );
    if (first) selectLab(first.id);
  }

  function chooseChapter(chapter: string) {
    setSelectedChapter(chapter);
    const first = hub?.labs.find(
      (lab) =>
        (selectedSubject === "all" || lab.subject === selectedSubject) &&
        (chapter === "all" || lab.chapter === chapter),
    );
    if (first) selectLab(first.id);
  }

  function changeValue(key: string, value: number) {
    setValues((current) => ({ ...current, [key]: value }));
    setHasRun(false);
    setMessage("");
    setError("");
  }

  function runExperiment() {
    setHasRun(true);
    setRunVersion((version) => version + 1);
    setError("");
    setMessage("");
  }

  function recordObservation() {
    if (!selected) return;
    const note = `${selected.formula} → ${selected.resultLabel}: ${formatResult(result)} ${selected.unit}`.trim();
    setObservations((current) => [note, ...current].slice(0, 4));
  }

  async function completeLab() {
    if (!selected) return;
    if (!mastery.valid) {
      setError(`মিশনটি এখনো সম্পন্ন হয়নি—${selected.challenge}`);
      setMessage("");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    const response = await apiFetch<CompletionResponse>("/api/labs/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labId: selected.id, values }),
    });
    if (response.ok && isApiSuccess(response.payload)) {
      const data = response.payload.data;
      setHub(data.hub);
      setMessage(
        data.alreadyCompleted
          ? "এই অধ্যায়ের মাস্টারি আগেই সম্পন্ন হয়েছে—নতুন মান দিয়ে আরও পরীক্ষা করুন।"
          : `চমৎকার! অধ্যায় মাস্টারি সম্পন্ন হয়েছে এবং +${data.reward.xp} XP যোগ হয়েছে।`,
      );
      trackStudentEvent("student_science_lab_completed", "science_lab", {
        lab_id: selected.id,
        subject: selected.subject,
        chapter: selected.chapter,
        result: Number(result.toFixed(2)),
        xp_earned: data.reward.xp,
      });
    } else {
      setError(
        getApiErrorMessage(
          response.payload,
          "ফলাফলটি মাস্টারি মিশনের শর্ত পূরণ করেনি।",
        ),
      );
    }
    setWorking(false);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="স্টেম ল্যাব লোড হচ্ছে">
        <div className="h-56 animate-pulse rounded-3xl bg-cyan-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-2xl bg-secondary/70"
            />
          ))}
        </div>
        <div className="h-[520px] animate-pulse rounded-3xl bg-secondary/70" />
      </div>
    );
  }

  if (!hub || !selected) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-7 text-center">
        <FlaskConical className="mx-auto size-10 text-red-600" />
        <h1 className="mt-3 text-xl font-black text-primary">
          স্টেম ল্যাব খোলা যায়নি
        </h1>
        <p className="mt-2 text-sm text-red-800">{error}</p>
      </section>
    );
  }

  const theme = familyTheme[selected.family];
  const ActiveIcon = theme.icon;

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-900 via-blue-900 to-indigo-950 px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div
          aria-hidden
          className="absolute -right-16 -top-24 size-64 rounded-full bg-cyan-300/10 blur-sm"
        />
        <div
          aria-hidden
          className="absolute -bottom-28 left-1/3 size-60 rounded-full bg-violet-300/10"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              <Microscope className="size-4" />
              ইন্টার‌্যাক্টিভ স্টেম ল্যাব · {hub.level.toUpperCase()}
            </div>
            <h1 className="mt-3 text-3xl font-black sm:text-5xl">
              অধ্যায় খুলুন, পরীক্ষা চালান, আবিষ্কার করুন
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              পদার্থবিজ্ঞান, রসায়ন, উচ্চতর গণিত ও আইসিটির প্রতিটি নির্বাচিত
              অধ্যায়ে পূর্বানুমান, লাইভ সিমুলেশন, পর্যবেক্ষণ নোট এবং মাস্টারি
              মিশন একসাথে।
            </p>
          </div>
          <div className="min-w-64 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-2xl bg-cyan-300 text-xl font-black text-blue-950">
                {hub.progress.completed}/{hub.progress.total}
              </div>
              <div>
                <p className="text-sm font-black">ল্যাব মাস্টারি</p>
                <p className="mt-1 text-xs font-semibold text-white/65">
                  {hub.progress.xpEarned} XP অর্জিত
                </p>
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-[width]"
                style={{ width: `${hub.progress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-right text-2xs font-black text-cyan-100">
              {hub.progress.percent}% সম্পন্ন
            </p>
          </div>
        </div>
      </header>

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

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-muted">
              বিষয়
            </span>
            <select
              value={selectedSubject}
              onChange={(event) => chooseSubject(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-bold text-primary outline-none focus:border-cyan-500"
            >
              <option value="all">সব স্টেম বিষয়</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-muted">
              অধ্যায়
            </span>
            <select
              value={selectedChapter}
              onChange={(event) => chooseChapter(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-bold text-primary outline-none focus:border-cyan-500"
            >
              <option value="all">সব ল্যাব অধ্যায়</option>
              {chapters.map((chapter) => (
                <option key={chapter} value={chapter}>
                  {getTranslatedChapter(chapter)}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl bg-cyan-50 px-4 py-3 text-center text-sm font-black text-cyan-900">
            {filteredLabs.length}টি ইন্টার‌্যাক্টিভ ল্যাব
          </div>
        </div>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="tablist"
        aria-label="অধ্যায়ভিত্তিক স্টেম ল্যাব"
      >
        {filteredLabs.map((lab) => {
          const labTheme = familyTheme[lab.family];
          const Icon = labTheme.icon;
          const isSelected = lab.id === activeLabId;
          return (
            <button
              key={lab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => selectLab(lab.id)}
              className={cn(
                "relative min-h-40 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                isSelected
                  ? cn("ring-2", labTheme.active)
                  : cn("bg-card", labTheme.card),
              )}
            >
              {lab.completed && (
                <CheckCircle2 className="absolute right-3 top-3 size-5 text-emerald-600" />
              )}
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-xl",
                  labTheme.iconStyle,
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="mt-3 block text-sm font-black text-primary">
                {lab.title}
              </span>
              <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-muted">
                {getTranslatedChapter(lab.chapter)}
              </span>
              <span className="mt-2 inline-flex rounded-full bg-white/70 px-2 py-1 text-2xs font-black text-primary">
                +{lab.xp} XP
              </span>
            </button>
          );
        })}
      </div>

      {filteredLabs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto size-9 text-muted" />
          <p className="mt-3 text-sm font-black text-primary">
            এই ফিল্টারে কোনো ল্যাব নেই
          </p>
        </div>
      )}

      <article
        role="tabpanel"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-md)]"
      >
        <div className="border-b border-border px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-xl",
                  theme.iconStyle,
                )}
              >
                <ActiveIcon className="size-6" />
              </span>
              <div>
                <p
                  className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    theme.accent,
                  )}
                >
                  {selected.subject}
                </p>
                <h2 className="mt-1 text-xl font-black text-primary sm:text-2xl">
                  {selected.title}
                </h2>
                <p className="mt-1 text-xs font-bold text-muted">
                  {getTranslatedChapter(selected.chapter)}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-muted">
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

        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-secondary/25 p-5 sm:p-7">
            <SimulationStage
              key={`${selected.id}-${runVersion}`}
              lab={selected}
              values={values}
              result={result}
            />

            <div className="mt-5 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted">
                    আগে অনুমান করুন
                  </p>
                  <p className="mt-1 text-sm font-bold text-primary">
                    ফলাফল লক্ষ্য থেকে কোথায় থাকবে?
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {predictionLabels.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setPrediction(item.value);
                        setHasRun(false);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-black transition",
                        prediction === item.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted hover:text-primary",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full rounded-xl"
                onClick={runExperiment}
              >
                <Play className="size-4" /> পরীক্ষা চালান
              </Button>
              {hasRun && prediction && (
                <div
                  className={cn(
                    "mt-3 rounded-xl p-3 text-center text-sm font-black",
                    prediction === relation
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900",
                  )}
                >
                  {prediction === relation
                    ? "দারুণ—আপনার পূর্বানুমান সঠিক!"
                    : `ফলাফল ছিল “${predictionLabels.find((item) => item.value === relation)?.label}”—মান বদলে আবার দেখুন।`}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {selected.controls.map((item) => (
                <LabControlField
                  key={item.key}
                  control={item}
                  value={values[item.key] ?? item.initial}
                  onChange={(value) => changeValue(item.key, value)}
                />
              ))}
            </div>
          </div>

          <aside className="border-t border-border p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <p className="text-xs font-black uppercase tracking-widest text-white/65">
                মাস্টারি মিশন
              </p>
              <h3 className="mt-2 text-lg font-black">{selected.challenge}</h3>
              <div className="mt-4 rounded-xl bg-white/10 p-4 text-center">
                <p className="text-xs font-bold text-white/60">
                  {selected.resultLabel}
                </p>
                <p className="mt-1 text-4xl font-black">
                  {formatResult(result)}
                  {selected.unit && (
                    <span className="ml-1 text-base text-white/60">
                      {selected.unit}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs font-bold text-cyan-200">
                  সূত্র: {selected.formula}
                </p>
              </div>
            </div>

            <div
              className={cn(
                "mt-4 rounded-2xl border p-4",
                mastery.valid
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-border bg-secondary/50",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-muted">লক্ষ্য</span>
                <span className="text-lg font-black text-primary">
                  {selected.target} {selected.unit}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    mastery.valid ? "bg-emerald-500" : "bg-cyan-500",
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(4, (result / selected.target) * 100),
                    )}%`,
                  }}
                />
              </div>
              {mastery.valid && (
                <p className="mt-2 text-center text-xs font-black text-emerald-800">
                  লক্ষ্য মিলেছে—মাস্টারি সংগ্রহ করুন!
                </p>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 size-5 shrink-0 text-cyan-700" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-cyan-800">
                    কেন এমন হলো?
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-cyan-950">
                    {selected.insight}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={recordObservation}
              >
                <NotebookPen className="size-4" /> পর্যবেক্ষণ নোট করুন
              </Button>
              {observations.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-3">
                  {observations.map((observation, index) => (
                    <p
                      key={`${observation}-${index}`}
                      className="text-xs font-semibold leading-5 text-muted"
                    >
                      {index + 1}. {observation}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-900">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-4 text-amber-600" />
                এককালীন পুরস্কার
              </span>
              <span>+{selected.xp} XP</span>
            </div>
            <Button
              className={cn("mt-4 min-h-12 w-full rounded-xl", theme.button)}
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
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => {
                setValues(getInitialLabValues(selected.id));
                setPrediction(null);
                setHasRun(false);
                setObservations([]);
                setError("");
                setMessage("");
              }}
            >
              <RotateCcw className="size-4" /> ল্যাব রিসেট
            </Button>
          </aside>
        </div>
      </article>
    </section>
  );
}

function LabControlField({
  control,
  value,
  onChange,
}: {
  control: LabControl;
  value: number;
  onChange: (value: number) => void;
}) {
  if (
    control.choices?.length === 2 &&
    control.choices.every((choice) => choice.value === 0 || choice.value === 1)
  ) {
    return (
      <button
        type="button"
        onClick={() => onChange(value === 1 ? 0 : 1)}
        className={cn(
          "flex min-h-20 items-center justify-between rounded-2xl border p-4 text-left transition",
          value === 1
            ? "border-emerald-400 bg-emerald-50"
            : "border-border bg-card",
        )}
      >
        <span>
          <span className="block text-sm font-black text-primary">
            {control.label}
          </span>
          <span className="mt-1 block text-xs font-semibold text-muted">
            চাপ দিয়ে অন/অফ করুন
          </span>
        </span>
        <span
          className={cn(
            "grid size-11 place-items-center rounded-xl text-lg font-black",
            value === 1
              ? "bg-emerald-600 text-white"
              : "bg-secondary text-muted",
          )}
        >
          {value}
        </span>
      </button>
    );
  }

  if (control.choices) {
    return (
      <label className="block rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-black text-primary">{control.label}</span>
        <select
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-3 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-bold text-primary outline-none focus:border-cyan-500"
        >
          {control.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block rounded-2xl border border-border bg-card p-4">
      <span className="flex items-center justify-between gap-3 text-sm font-black text-primary">
        <span>{control.label}</span>
        <span className="rounded-lg bg-primary px-2.5 py-1 text-xs text-primary-foreground">
          {value} {control.unit}
        </span>
      </span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 w-full accent-primary"
        aria-label={control.label}
      />
      <span className="mt-2 flex justify-between text-2xs font-bold text-muted">
        <span>{control.min}</span>
        <span>{control.max}</span>
      </span>
    </label>
  );
}

function SimulationStage({
  lab,
  values,
  result,
}: {
  lab: LabSummary;
  values: LabInputValues;
  result: number;
}) {
  const theme = familyTheme[lab.family];
  const intensity = Math.min(
    1.35,
    Math.max(0.08, Math.abs(result / (lab.target || 1))),
  );

  return (
    <div
      className={cn(
        "relative min-h-80 overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-inner",
        theme.stage,
      )}
      style={{ perspective: "900px" }}
    >
      <div className="absolute inset-x-0 bottom-0 h-2/3 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:32px_32px] [transform:rotateX(62deg)_scale(1.35)] [transform-origin:bottom]" />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black backdrop-blur">
          LIVE · {lab.formula}
        </span>
        <span className="rounded-full bg-cyan-300 px-3 py-1.5 text-xs font-black text-cyan-950">
          {formatResult(result)} {lab.unit}
        </span>
      </div>

      <div className="relative z-10 mt-6 grid min-h-56 place-items-center">
        {lab.family === "physics" && (
          <PhysicsScene labId={lab.id} values={values} intensity={intensity} />
        )}
        {lab.family === "chemistry" && (
          <ChemistryScene labId={lab.id} values={values} intensity={intensity} />
        )}
        {lab.family === "math" && (
          <MathScene labId={lab.id} values={values} result={result} />
        )}
        {lab.family === "ict" && (
          <IctScene labId={lab.id} values={values} result={result} />
        )}
      </div>
    </div>
  );
}

function PhysicsScene({
  labId,
  values,
  intensity,
}: {
  labId: ScienceLabId;
  values: LabInputValues;
  intensity: number;
}) {
  if (labId === "circuit") {
    return (
      <div className="relative size-52 rounded-[42px] border-4 border-cyan-300/60 shadow-[0_0_45px_rgba(34,211,238,.25)] [transform:rotateX(58deg)_rotateZ(-12deg)] [transform-style:preserve-3d]">
        <div
          className="absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-amber-200 bg-amber-300 text-amber-950 shadow-[0_0_55px_rgba(252,211,77,.75)] [transform:translateZ(55px)]"
          style={{ opacity: 0.45 + intensity * 0.4 }}
        >
          <BatteryCharging className="size-10" />
        </div>
        {[8, 30, 52, 74].map((position) => (
          <span
            key={position}
            className="absolute size-3 animate-pulse rounded-full bg-cyan-200"
            style={{
              left: `${position}%`,
              top: position % 2 === 0 ? "4%" : "88%",
              animationDuration: `${Math.max(0.35, 1.4 / intensity)}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (labId === "wave" || labId === "trigonometry") {
    const frequency = values.frequency ?? 3;
    return (
      <div className="flex h-48 w-full items-center justify-center gap-1 [transform:rotateX(10deg)]">
        {Array.from({ length: 24 }, (_, index) => {
          const height =
            24 +
            Math.abs(
              Math.sin((index / 24) * Math.PI * 2 * frequency),
            ) *
              120 *
              Math.min(1, intensity);
          return (
            <span
              key={index}
              className="w-2 rounded-full bg-gradient-to-t from-cyan-500 to-white shadow-[0_0_12px_rgba(103,232,249,.6)] transition-[height] duration-300"
              style={{ height }}
            />
          );
        })}
      </div>
    );
  }

  if (labId === "optics") {
    return (
      <div className="relative h-52 w-full">
        <div className="absolute left-1/2 top-1/2 h-44 w-10 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-cyan-200 bg-cyan-200/20 shadow-[0_0_36px_rgba(165,243,252,.45)]" />
        <div className="absolute left-[12%] top-1/2 h-20 w-3 -translate-y-1/2 rounded-t-full bg-amber-300 shadow-lg" />
        <div
          className="absolute left-[13%] top-[38%] h-0.5 origin-left bg-red-300 shadow-[0_0_8px_rgba(252,165,165,.8)]"
          style={{
            width: "74%",
            transform: `rotate(${8 + intensity * 5}deg)`,
          }}
        />
        <div
          className="absolute left-[13%] top-[62%] h-0.5 origin-left bg-cyan-200 shadow-[0_0_8px_rgba(165,243,252,.8)]"
          style={{
            width: "74%",
            transform: `rotate(${-8 - intensity * 5}deg)`,
          }}
        />
        <div className="absolute right-[10%] top-1/2 h-28 w-3 -translate-y-1/2 rotate-180 rounded-t-full bg-emerald-300" />
      </div>
    );
  }

  return (
    <div className="relative h-52 w-full [transform-style:preserve-3d]">
      <div className="absolute inset-x-8 bottom-8 h-4 rounded-full bg-white/20 [transform:rotateX(60deg)]" />
      <div
        className="absolute bottom-16 grid size-24 place-items-center rounded-2xl border border-white/35 bg-gradient-to-br from-cyan-300 to-blue-600 text-blue-950 shadow-2xl transition-[left,transform] duration-700 [transform:rotateY(-18deg)_rotateX(8deg)]"
        style={{ left: `${Math.min(72, 5 + intensity * 50)}%` }}
      >
        <Gauge className="size-10" />
      </div>
      <div className="absolute bottom-5 left-6 right-6 flex justify-between text-2xs font-black text-white/55">
        <span>শুরু</span>
        <span>লক্ষ্য</span>
      </div>
    </div>
  );
}

function ChemistryScene({
  labId,
  values,
  intensity,
}: {
  labId: ScienceLabId;
  values: LabInputValues;
  intensity: number;
}) {
  if (labId === "atom") {
    const electrons = Math.max(1, Math.round(values.electrons ?? 1));
    return (
      <div className="relative size-56 [transform:rotateX(58deg)_rotateZ(-18deg)] [transform-style:preserve-3d]">
        {[0, 1, 2].map((ring) => (
          <div
            key={ring}
            className="absolute inset-6 rounded-full border border-cyan-200/55"
            style={{ transform: `rotateY(${ring * 60}deg)` }}
          >
            {Array.from(
              { length: Math.min(4, Math.ceil(electrons / 3)) },
              (_, index) => (
                <span
                  key={index}
                  className="absolute size-3 animate-pulse rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,.9)]"
                  style={{
                    left: `${10 + index * 26}%`,
                    top: index % 2 === 0 ? "3%" : "88%",
                  }}
                />
              ),
            )}
          </div>
        ))}
        <div className="absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-fuchsia-300 to-violet-600 shadow-[0_0_55px_rgba(216,180,254,.65)] [transform:translateZ(38px)]">
          <Atom className="size-11" />
        </div>
      </div>
    );
  }

  const fill =
    labId === "ph"
      ? Math.max(12, Math.min(90, ((14 - (values.phValue ?? 7)) / 13) * 85))
      : Math.min(90, 22 + intensity * 48);
  const liquid =
    labId === "ph"
      ? (values.phValue ?? 7) < 7
        ? "from-rose-500 to-orange-300"
        : (values.phValue ?? 7) > 7
          ? "from-indigo-500 to-cyan-300"
          : "from-emerald-500 to-lime-300"
      : "from-violet-500 to-cyan-300";

  return (
    <div className="relative h-60 w-52 [transform:rotateY(-12deg)] [transform-style:preserve-3d]">
      <div className="absolute inset-x-8 bottom-1 h-52 overflow-hidden rounded-b-[54px] border-x-4 border-b-4 border-white/45 bg-white/10 shadow-2xl">
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t transition-[height] duration-500",
            liquid,
          )}
          style={{ height: `${fill}%` }}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className="absolute size-2 animate-pulse rounded-full border border-white/50 bg-white/25"
              style={{
                left: `${8 + ((index * 23) % 82)}%`,
                bottom: `${8 + ((index * 17) % 78)}%`,
                animationDelay: `${index * 80}ms`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute left-1/2 top-2 h-8 w-32 -translate-x-1/2 rounded-[50%] border-4 border-white/50 bg-white/10" />
      <Beaker className="absolute -right-1 top-4 size-9 text-white/35" />
    </div>
  );
}

function MathScene({
  labId,
  values,
  result,
}: {
  labId: ScienceLabId;
  values: LabInputValues;
  result: number;
}) {
  if (labId === "probability") {
    const percent = Math.max(0, Math.min(100, result));
    return (
      <div
        className="relative grid size-52 place-items-center rounded-full border-8 border-white/30 shadow-2xl [transform:rotateX(18deg)]"
        style={{
          background: `conic-gradient(#34d399 0 ${percent}%, rgba(255,255,255,.12) ${percent}% 100%)`,
        }}
      >
        <div className="grid size-28 place-items-center rounded-full bg-emerald-950 text-center shadow-inner">
          <span className="text-3xl font-black">{formatResult(percent)}%</span>
        </div>
        <span className="absolute -top-4 left-1/2 size-0 -translate-x-1/2 border-x-[10px] border-t-[22px] border-x-transparent border-t-amber-300" />
      </div>
    );
  }

  if (labId === "vector") {
    const x = values.x ?? 0;
    const y = values.y ?? 0;
    const angle = Math.atan2(y, x) * (180 / Math.PI);
    const length = Math.min(190, result * 25);
    return (
      <div className="relative h-56 w-full">
        <div className="absolute bottom-8 left-8 h-px w-[82%] bg-white/30" />
        <div className="absolute bottom-8 left-8 h-[82%] w-px bg-white/30" />
        <div
          className="absolute bottom-8 left-8 h-2 origin-left rounded-full bg-gradient-to-r from-emerald-300 to-cyan-200 shadow-[0_0_16px_rgba(110,231,183,.7)] transition-[width,transform] duration-500"
          style={{ width: length, transform: `rotate(${-angle}deg)` }}
        >
          <span className="absolute -right-2 -top-1.5 size-0 border-y-[7px] border-l-[14px] border-y-transparent border-l-cyan-200" />
        </div>
        <div className="absolute right-4 top-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-black">
          ({x}, {y})
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-52 w-full items-end justify-center gap-2">
      {Array.from({ length: 18 }, (_, index) => {
        const amplitude = values.amplitude ?? 2;
        const frequency = values.frequency ?? 2;
        const height =
          28 +
          ((Math.sin(index * frequency * 0.42) + 1) / 2) * amplitude * 24;
        return (
          <span
            key={index}
            className="w-3 rounded-t-full bg-gradient-to-t from-emerald-600 to-cyan-200 shadow-[0_0_12px_rgba(110,231,183,.4)] transition-[height] duration-300"
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function IctScene({
  labId,
  values,
  result,
}: {
  labId: ScienceLabId;
  values: LabInputValues;
  result: number;
}) {
  if (labId === "binary") {
    return (
      <div className="grid grid-cols-3 gap-3 [transform:rotateX(12deg)] sm:grid-cols-6">
        {[32, 16, 8, 4, 2, 1].map((weight) => {
          const active = values[`bit${weight}`] === 1;
          return (
            <div
              key={weight}
              className={cn(
                "grid h-24 w-16 place-items-center rounded-2xl border text-center shadow-xl transition",
                active
                  ? "border-cyan-200 bg-cyan-300 text-cyan-950 shadow-cyan-400/30"
                  : "border-white/15 bg-white/5 text-white/45",
              )}
            >
              <div>
                <Binary className="mx-auto size-5" />
                <p className="mt-1 text-xl font-black">{active ? 1 : 0}</p>
                <p className="text-2xs font-bold">× {weight}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (labId === "logic") {
    const gate = ["AND", "OR", "XOR"][values.gate ?? 0] ?? "AND";
    return (
      <div className="flex items-center gap-4 [transform:rotateX(10deg)]">
        {["inputA", "inputB"].map((key) => (
          <div
            key={key}
            className={cn(
              "grid size-16 place-items-center rounded-2xl border text-2xl font-black",
              values[key] === 1
                ? "border-emerald-300 bg-emerald-400 text-emerald-950"
                : "border-white/20 bg-white/5 text-white/50",
            )}
          >
            {values[key] ?? 0}
          </div>
        ))}
        <div className="grid h-24 w-32 place-items-center rounded-[42px] border-2 border-amber-200 bg-amber-300 text-xl font-black text-amber-950 shadow-[0_0_35px_rgba(252,211,77,.4)]">
          {gate}
        </div>
        <div
          className={cn(
            "grid size-20 place-items-center rounded-full border-4 text-3xl font-black",
            result === 1
              ? "border-cyan-200 bg-cyan-300 text-cyan-950 shadow-[0_0_35px_rgba(103,232,249,.55)]"
              : "border-white/20 bg-white/5 text-white/50",
          )}
        >
          {result}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-56 w-full">
      {[
        { left: "8%", top: "42%", icon: Cpu },
        { left: "43%", top: "8%", icon: Network },
        { left: "75%", top: "48%", icon: CircuitBoard },
      ].map((node, index) => {
        const Icon = node.icon;
        return (
          <div
            key={index}
            className="absolute grid size-20 place-items-center rounded-2xl border border-cyan-200/50 bg-cyan-300/15 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,.18)] backdrop-blur"
            style={{ left: node.left, top: node.top }}
          >
            <Icon className="size-9" />
          </div>
        );
      })}
      <div className="absolute left-[25%] top-[47%] h-1 w-[30%] rotate-[-26deg] bg-gradient-to-r from-cyan-300 to-transparent" />
      <div className="absolute left-[55%] top-[42%] h-1 w-[25%] rotate-[28deg] bg-gradient-to-r from-cyan-300 to-transparent" />
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="absolute top-1/2 size-2 animate-pulse rounded-full bg-amber-300"
          style={{
            left: `${20 + index * 11}%`,
            animationDelay: `${index * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

function formatResult(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toFixed(2)).toString();
}
