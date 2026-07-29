"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  FlaskConical,
  Gauge,
  Lightbulb,
  Microscope,
  NotebookPen,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LabConceptVisualizer } from "@/components/labs/LabConceptVisualizer";
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
            <LabConceptVisualizer
              key={`${selected.id}-${runVersion}`}
              labId={selected.id}
              values={values}
              result={result}
              runVersion={runVersion}
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

function formatResult(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toFixed(2)).toString();
}
