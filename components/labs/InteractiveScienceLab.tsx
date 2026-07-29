"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  CheckCircle2,
  Cpu,
  FlaskConical,
  Gauge,
  Microscope,
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
    iconStyle: "bg-sky-100 text-sky-700",
    accent: "text-sky-700",
    button: "bg-sky-700 hover:bg-sky-800",
  },
  chemistry: {
    label: "রসায়ন",
    icon: FlaskConical,
    iconStyle: "bg-violet-100 text-violet-700",
    accent: "text-violet-700",
    button: "bg-violet-700 hover:bg-violet-800",
  },
  math: {
    label: "গণিত",
    icon: Target,
    iconStyle: "bg-emerald-100 text-emerald-700",
    accent: "text-emerald-700",
    button: "bg-emerald-700 hover:bg-emerald-800",
  },
  ict: {
    label: "আইসিটি",
    icon: Cpu,
    iconStyle: "bg-amber-100 text-amber-700",
    accent: "text-amber-700",
    button: "bg-amber-600 hover:bg-amber-700",
  },
} satisfies Record<
  LabFamily,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
    iconStyle: string;
    accent: string;
    button: string;
  }
>;

export function InteractiveScienceLab() {
  const [hub, setHub] = useState<LabHub | null>(null);
  const [activeLabId, setActiveLabId] = useState<ScienceLabId>("motion");
  const [values, setValues] = useState<LabInputValues>(
    getInitialLabValues("motion"),
  );
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedChapter, setSelectedChapter] = useState("all");
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
  const masteryProgress =
    selected && Number.isFinite(result)
      ? Math.max(
          4,
          100 -
            (Math.abs(result - selected.target) /
              Math.max(1, Math.abs(selected.target))) *
              100,
        )
      : 4;

  function selectLab(labId: ScienceLabId) {
    setActiveLabId(labId);
    setValues(getInitialLabValues(labId));
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
    setMessage("");
    setError("");
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
      <div className="space-y-4 sm:space-y-5" aria-label="স্টেম ল্যাব লোড হচ্ছে">
        <div className="h-48 animate-pulse rounded-2xl bg-cyan-100 sm:h-56 sm:rounded-3xl" />
        <div className="h-32 animate-pulse rounded-2xl bg-secondary/70" />
        <div className="h-[640px] animate-pulse rounded-2xl bg-secondary/70 sm:rounded-3xl" />
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
    <section className="space-y-4 sm:space-y-6">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-900 via-blue-900 to-indigo-950 px-5 py-6 text-white shadow-xl sm:rounded-3xl sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="absolute -right-16 -top-24 size-64 rounded-full bg-cyan-300/10 blur-sm"
        />
        <div
          aria-hidden
          className="absolute -bottom-28 left-1/3 size-60 rounded-full bg-violet-300/10"
        />
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              <Microscope className="size-4" />
              ইন্টার‌্যাক্টিভ স্টেম ল্যাব · {hub.level.toUpperCase()}
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">
              দেখুন, নিয়ন্ত্রণ করুন, ধারণাটি বুঝুন
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              বিষয় ও অধ্যায় বেছে চলক পরিবর্তন করুন। ভেতরের প্রক্রিয়া,
              কারণ–ফল এবং প্রচলিত ভুল ধারণা একই মডেলে দেখুন।
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md sm:min-w-64 sm:p-4">
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-xl bg-cyan-300 text-base font-black text-blue-950 sm:size-16 sm:rounded-2xl sm:text-xl">
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

      <nav
        className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-sm)] sm:p-4"
        aria-label="স্টেম ল্যাব নির্বাচন"
      >
        <div
          className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="বিষয় নির্বাচন"
        >
          {["all", ...subjects].map((subject) => {
            const active = selectedSubject === subject;
            return (
              <button
                key={subject}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => chooseSubject(subject)}
                className={cn(
                  "min-h-10 shrink-0 snap-start rounded-full border px-4 text-xs font-black transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted hover:border-cyan-400 hover:text-primary",
                )}
              >
                {subject === "all" ? "সব বিষয়" : subject}
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-2xs font-black uppercase tracking-wider text-muted">
              অধ্যায়
            </span>
            <select
              value={selectedChapter}
              onChange={(event) => chooseChapter(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-bold text-primary outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
            >
              <option value="all">সব ল্যাব অধ্যায়</option>
              {chapters.map((chapter) => (
                <option key={chapter} value={chapter}>
                  {getTranslatedChapter(chapter)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="flex items-center justify-between gap-2 text-2xs font-black uppercase tracking-wider text-muted">
              <span>ল্যাব মিশন</span>
              <span>{filteredLabs.length}টি পাওয়া গেছে</span>
            </span>
            <select
              value={activeLabId}
              onChange={(event) =>
                selectLab(event.target.value as ScienceLabId)
              }
              className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-bold text-primary outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
            >
              {filteredLabs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.completed ? "✓ " : ""}
                  {lab.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </nav>

      <article
        role="tabpanel"
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-md)] sm:rounded-3xl"
      >
        <div className="border-b border-border px-4 py-4 sm:px-7 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl sm:size-12",
                  theme.iconStyle,
                )}
              >
                <ActiveIcon className="size-5 sm:size-6" />
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-2xs font-black uppercase tracking-widest sm:text-xs",
                    theme.accent,
                  )}
                >
                  {selected.subject}
                </p>
                <h2 className="mt-1 text-lg font-black text-primary sm:text-2xl">
                  {selected.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs font-bold text-muted">
                  {getTranslatedChapter(selected.chapter)}
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

        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 bg-secondary/25 p-3 sm:p-6">
            <LabConceptVisualizer
              key={selected.id}
              labId={selected.id}
              values={values}
              result={result}
            />

            <section className="mt-4 rounded-2xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xs font-black uppercase tracking-wider text-muted">
                    পরীক্ষার নিয়ন্ত্রণ
                  </p>
                  <p className="mt-1 text-sm font-black text-primary">
                    মান বদলালেই মডেলটি লাইভ আপডেট হবে
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-xl"
                  onClick={() => {
                    setValues(getInitialLabValues(selected.id));
                    setError("");
                    setMessage("");
                  }}
                >
                  <RotateCcw className="size-4" />
                  <span className="hidden sm:inline">রিসেট</span>
                </Button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selected.controls.map((item) => (
                  <LabControlField
                    key={item.key}
                    control={item}
                    value={values[item.key] ?? item.initial}
                    onChange={(value) => changeValue(item.key, value)}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="border-t border-border p-4 sm:p-6 xl:border-l xl:border-t-0">
            <div className="xl:sticky xl:top-20">
              <div className="rounded-2xl bg-primary p-4 text-primary-foreground sm:p-5">
              <p className="text-xs font-black uppercase tracking-widest text-white/65">
                মাস্টারি মিশন
              </p>
              <h3 className="mt-2 text-lg font-black">{selected.challenge}</h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/10 p-3 text-center">
                    <p className="text-2xs font-bold text-white/60">বর্তমান</p>
                    <p className="mt-1 text-2xl font-black">
                      {formatResult(result)}
                      {selected.unit && (
                        <span className="ml-1 text-xs text-white/60">
                          {selected.unit}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3 text-center">
                    <p className="text-2xs font-bold text-white/60">লক্ষ্য</p>
                    <p className="mt-1 text-2xl font-black">
                      {selected.target}
                      {selected.unit && (
                        <span className="ml-1 text-xs text-white/60">
                          {selected.unit}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-center text-2xs font-bold text-cyan-200">
                  গাণিতিক সম্পর্ক: {selected.formula}
                </p>
              </div>

              <div
                className={cn(
                  "mt-3 rounded-2xl border p-4",
                  mastery.valid
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-border bg-secondary/50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-muted">
                    লক্ষ্য থেকে মিল
                  </span>
                  <span className="text-sm font-black text-primary">
                    {Math.round(Math.min(100, masteryProgress))}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      mastery.valid ? "bg-emerald-500" : "bg-cyan-500",
                    )}
                    style={{ width: `${Math.min(100, masteryProgress)}%` }}
                  />
                </div>
                <p
                  className={cn(
                    "mt-2 text-center text-xs font-black",
                    mastery.valid ? "text-emerald-800" : "text-muted",
                  )}
                >
                  {mastery.valid
                    ? "লক্ষ্য মিলেছে—মাস্টারি সংগ্রহ করুন!"
                    : "চলক বদলে বর্তমান মানকে লক্ষ্যের সঙ্গে মেলান"}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-900">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-600" />
                  এককালীন পুরস্কার
                </span>
                <span>+{selected.xp} XP</span>
              </div>
              <Button
                className={cn("mt-3 min-h-12 w-full rounded-xl", theme.button)}
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
            </div>
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
