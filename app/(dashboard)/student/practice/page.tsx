"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Atom,
  Award,
  Beaker,
  Book,
  BookOpen,
  Calculator,
  Calendar,
  Clock,
  Compass,
  Cpu,
  Dna,
  FileText,
  Globe,
  GraduationCap,
  Sparkles,
} from "lucide-react";

import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { guestLevelQuery, useGuestLevel } from "@/lib/hooks/use-guest-level";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/hooks/use-session";

type SubjectStatus = {
  subject: string;
  chapters: string[];
  lastResult: {
    score: number;
    totalQuestions: number;
    percentage: number;
    isPassed: boolean;
    timeTaken: number;
    submittedAt: string;
  } | null;
  teacherName?: string | null;
};

// Map subjects to icons and premium Tailwind gradient backgrounds
const subjectThemeMap: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    cardBg: string;
    iconBg: string;
    badgeBg: string;
    badgeText: string;
    paperLabel?: string;
  }
> = {
  "পদার্থবিজ্ঞান": {
    icon: Atom,
    accentColor: "text-brand-blue",
    cardBg: "from-blue-50/50 to-indigo-50/20 hover:border-blue-300/60",
    iconBg: "bg-blue-100 text-blue-700",
    badgeBg: "bg-blue-50 text-blue-800 border-blue-100",
    badgeText: "text-blue-700",
  },
  "পদার্থবিজ্ঞান ১ম পত্র": {
    icon: Atom,
    accentColor: "text-blue-600",
    cardBg: "from-blue-50/60 to-sky-50/30 hover:border-blue-400/60",
    iconBg: "bg-blue-100 text-blue-700",
    badgeBg: "bg-blue-50 text-blue-800 border-blue-100",
    badgeText: "text-blue-700",
    paperLabel: "১ম পত্র",
  },
  "পদার্থবিজ্ঞান ২য় পত্র": {
    icon: Atom,
    accentColor: "text-indigo-600",
    cardBg: "from-indigo-50/60 to-violet-50/30 hover:border-indigo-400/60",
    iconBg: "bg-indigo-100 text-indigo-700",
    badgeBg: "bg-indigo-50 text-indigo-800 border-indigo-100",
    badgeText: "text-indigo-700",
    paperLabel: "২য় পত্র",
  },
  "রসায়ন": {
    icon: Beaker,
    accentColor: "text-emerald-600",
    cardBg: "from-emerald-50/40 to-teal-50/20 hover:border-emerald-300/60",
    iconBg: "bg-emerald-100 text-emerald-700",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-100",
    badgeText: "text-emerald-700",
  },
  "রসায়ন ১ম পত্র": {
    icon: Beaker,
    accentColor: "text-emerald-600",
    cardBg: "from-emerald-50/60 to-green-50/30 hover:border-emerald-400/60",
    iconBg: "bg-emerald-100 text-emerald-700",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-100",
    badgeText: "text-emerald-700",
    paperLabel: "১ম পত্র",
  },
  "রসায়ন ২য় পত্র": {
    icon: Beaker,
    accentColor: "text-teal-600",
    cardBg: "from-teal-50/60 to-cyan-50/30 hover:border-teal-400/60",
    iconBg: "bg-teal-100 text-teal-700",
    badgeBg: "bg-teal-50 text-teal-800 border-teal-100",
    badgeText: "text-teal-700",
    paperLabel: "২য় পত্র",
  },
  "সাধারণ গণিত": {
    icon: Calculator,
    accentColor: "text-amber-600",
    cardBg: "from-amber-50/40 to-orange-50/20 hover:border-amber-300/60",
    iconBg: "bg-amber-100 text-amber-700",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-100",
    badgeText: "text-amber-700",
  },
  "উচ্চতর গণিত": {
    icon: GraduationCap,
    accentColor: "text-purple-600",
    cardBg: "from-purple-50/40 to-fuchsia-50/20 hover:border-purple-300/60",
    iconBg: "bg-purple-100 text-purple-700",
    badgeBg: "bg-purple-50 text-purple-800 border-purple-100",
    badgeText: "text-purple-700",
  },
  "উচ্চতর গণিত ১ম পত্র": {
    icon: GraduationCap,
    accentColor: "text-purple-600",
    cardBg: "from-purple-50/60 to-violet-50/30 hover:border-purple-400/60",
    iconBg: "bg-purple-100 text-purple-700",
    badgeBg: "bg-purple-50 text-purple-800 border-purple-100",
    badgeText: "text-purple-700",
    paperLabel: "১ম পত্র",
  },
  "উচ্চতর গণিত ২য় পত্র": {
    icon: GraduationCap,
    accentColor: "text-fuchsia-600",
    cardBg: "from-fuchsia-50/60 to-pink-50/30 hover:border-fuchsia-400/60",
    iconBg: "bg-fuchsia-100 text-fuchsia-700",
    badgeBg: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100",
    badgeText: "text-fuchsia-700",
    paperLabel: "২য় পত্র",
  },
  "জীববিজ্ঞান": {
    icon: Dna,
    accentColor: "text-green-600",
    cardBg: "from-green-50/40 to-emerald-50/20 hover:border-green-300/60",
    iconBg: "bg-green-100 text-green-700",
    badgeBg: "bg-green-50 text-green-800 border-green-100",
    badgeText: "text-green-700",
  },
  "জীববিজ্ঞান ১ম পত্র": {
    icon: Dna,
    accentColor: "text-green-600",
    cardBg: "from-green-50/60 to-emerald-50/30 hover:border-green-400/60",
    iconBg: "bg-green-100 text-green-700",
    badgeBg: "bg-green-50 text-green-800 border-green-100",
    badgeText: "text-green-700",
    paperLabel: "১ম পত্র",
  },
  "জীববিজ্ঞান ২য় পত্র": {
    icon: Dna,
    accentColor: "text-emerald-600",
    cardBg: "from-emerald-50/60 to-teal-50/30 hover:border-emerald-400/60",
    iconBg: "bg-emerald-100 text-emerald-700",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-100",
    badgeText: "text-emerald-700",
    paperLabel: "২য় পত্র",
  },
  "তথ্য ও যোগাযোগ প্রযুক্তি": {
    icon: Cpu,
    accentColor: "text-rose-600",
    cardBg: "from-rose-50/40 to-pink-50/20 hover:border-rose-300/60",
    iconBg: "bg-rose-100 text-rose-700",
    badgeBg: "bg-rose-50 text-rose-800 border-rose-100",
    badgeText: "text-rose-700",
  },
  "বাংলা ১ম পত্র": {
    icon: Book,
    accentColor: "text-orange-600",
    cardBg: "from-orange-50/40 to-amber-50/20 hover:border-orange-300/60",
    iconBg: "bg-orange-100 text-orange-700",
    badgeBg: "bg-orange-50 text-orange-800 border-orange-100",
    badgeText: "text-orange-700",
    paperLabel: "১ম পত্র",
  },
  "বাংলা ২য় পত্র": {
    icon: Book,
    accentColor: "text-amber-600",
    cardBg: "from-amber-50/40 to-yellow-50/20 hover:border-amber-300/60",
    iconBg: "bg-amber-100 text-amber-700",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-100",
    badgeText: "text-amber-700",
    paperLabel: "২য় পত্র",
  },
  "ইংরেজি ১ম পত্র": {
    icon: FileText,
    accentColor: "text-sky-600",
    cardBg: "from-sky-50/40 to-cyan-50/20 hover:border-sky-300/60",
    iconBg: "bg-sky-100 text-sky-700",
    badgeBg: "bg-sky-50 text-sky-800 border-sky-100",
    badgeText: "text-sky-700",
    paperLabel: "১ম পত্র",
  },
  "ইংরেজি ২য় পত্র": {
    icon: FileText,
    accentColor: "text-blue-600",
    cardBg: "from-blue-50/40 to-indigo-50/20 hover:border-blue-300/60",
    iconBg: "bg-blue-100 text-blue-700",
    badgeBg: "bg-blue-50 text-blue-800 border-blue-100",
    badgeText: "text-blue-700",
    paperLabel: "২য় পত্র",
  },
  "ইসলাম ও নৈতিক শিক্ষা": {
    icon: Compass,
    accentColor: "text-teal-600",
    cardBg: "from-teal-50/40 to-emerald-50/20 hover:border-teal-300/60",
    iconBg: "bg-teal-100 text-teal-700",
    badgeBg: "bg-teal-50 text-teal-800 border-teal-100",
    badgeText: "text-teal-700",
  },
  "বাংলাদেশ ও বিশ্বপরিচয়": {
    icon: Globe,
    accentColor: "text-emerald-700",
    cardBg: "from-emerald-50/50 to-green-50/20 hover:border-emerald-300/60",
    iconBg: "bg-emerald-100 text-emerald-800",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-100",
    badgeText: "text-emerald-700",
  },
};

function StudentPracticeDashboard() {
  const path = (p: string) => p;
  const { user, checking } = useSession({ listenToAuthChanges: true });
  const isGuest = !user;
  const level = useGuestLevel();

  const [mode, setMode] = useState<"general" | "teacher">("general");
  const [statusList, setStatusList] = useState<SubjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (checking) return;

    async function loadStatus() {
      try {
        setLoading(true);
        setError("");
        const url = isGuest
          ? `/api/mcq/practice/status?scope=guest&level=${level}`
          : `/api/mcq/practice/status?mode=${mode}`;
        const { ok, payload } = await apiFetch<{ status: SubjectStatus[] }>(url);
        if (ok && isApiSuccess(payload)) {
          setStatusList(payload.data.status);
        } else {
          setError(getApiErrorMessage(payload, "Could not load practice data."));
        }
      } catch (err) {
        setError("An error occurred while connecting to the server.");
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, [checking, isGuest, level, mode]);

  return (
    <section className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-accent">
            {"শিক্ষার্থী প্যানেল"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-primary sm:text-4xl">
            {"অধ্যায়-ভিত্তিক এমসিকিউ পরীক্ষা"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {"সাবজেক্ট ও চ্যাপ্টার সিলেক্ট করে MCQ test শুরু করো।"}
          </p>
        </div>

        {!checking && isGuest && (
          <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-card/80 p-1 shadow-xs transition duration-200 hover:border-brand-blue/30 max-w-fit">
            <Link
              href={path(`/student/practice?level=SSC`)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-bold transition duration-200",
                level === "SSC"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:bg-secondary/40 hover:text-primary"
              )}
            >
              {"এসএসসি (SSC)"}
            </Link>
            <Link
              href={path(`/student/practice?level=HSC`)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-bold transition duration-200",
                level === "HSC"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:bg-secondary/40 hover:text-primary"
              )}
            >
              {"এইচএসসি (HSC)"}
            </Link>
          </div>
        )}
      </div>


      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border bg-card/40 p-5 space-y-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-xl bg-secondary animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-secondary animate-pulse" />
              </div>
              <div className="h-6 w-2/3 rounded bg-secondary animate-pulse mt-4" />
              <div className="rounded-xl border border-border/40 bg-surface/30 p-3.5 space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
                  <div className="h-4 w-12 rounded-full bg-secondary animate-pulse" />
                </div>
                <div className="h-5 w-1/4 rounded bg-secondary animate-pulse mt-1" />
              </div>
              <div className="h-10 w-full rounded-xl bg-secondary animate-pulse mt-5" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
      ) : statusList.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted">
          {"আপনার ক্লাসের জন্য কোনো mcq test প্রস্তুত নেই।"}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {statusList.map((item) => {
            const theme = subjectThemeMap[item.subject] || {
              icon: BookOpen,
              accentColor: "text-primary",
              cardBg: "from-secondary/30 to-background hover:border-primary/20",
              iconBg: "bg-secondary text-primary",
              badgeBg: "bg-secondary text-primary border-border",
              badgeText: "text-primary",
            };
            const Icon = theme.icon;
            const hasAttempt = item.lastResult !== null;
            const hasTeacher = mode !== "teacher" || !!item.teacherName;

            // Build query params string cleanly
            const queryParams = new URLSearchParams();
            if (mode === "teacher") {
              queryParams.set("mode", "teacher");
            }
            if (isGuest) {
              queryParams.set("level", level);
            }
            const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

            return (
              <div
                key={item.subject}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-gradient-to-br p-5 shadow-[var(--shadow-sm)] transition-all duration-300 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5",
                  theme.cardBg
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={cn("rounded-xl p-3 shadow-sm", theme.iconBg)}>
                      <Icon className="size-6 shrink-0" />
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        theme.badgeBg
                      )}
                    >
                      {item.chapters.length}{" "}
                      {`টি চ্যাপ্টার`}
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-xl font-bold text-primary">
                    {/* Show base subject name (strip paper suffix for cleaner display) */}
                    {item.subject.replace(/ (1st|2nd) Paper$/, "")} {theme.paperLabel }
                  </h2>

                  {mode === "teacher" && item.teacherName && (
                    <div className="mt-1 text-2xs font-bold text-emerald-700 bg-emerald-100/40 border border-emerald-100/50 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <GraduationCap className="size-3 shrink-0" />
                      <span>শিক্ষক: {item.teacherName}</span>
                    </div>
                  )}

                  {/* Previous Result Summary */}
                  <div className="mt-4">
                    {hasAttempt && item.lastResult ? (
                      <div className="rounded-xl border border-border bg-surface/80 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Award className="size-3.5 text-brand-yellow" />
                            {"সর্বশেষ স্কোর"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-bold text-[10px] uppercase",
                              item.lastResult.isPassed
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {item.lastResult.isPassed
                              ? "পাস"
                              : "ফেইল"}
                          </span>
                        </div>
                        <div className="font-display text-lg font-bold text-primary">
                          {item.lastResult.score} / {item.lastResult.totalQuestions}{" "}
                          <span className="text-sm font-sans font-medium text-muted">
                            ({item.lastResult.percentage}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-2xs text-muted font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {Math.floor(item.lastResult.timeTaken / 60)}m{" "}
                            {item.lastResult.timeTaken % 60}s
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(item.lastResult.submittedAt).toLocaleDateString(
                              "bn-BD",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-border p-4 text-center justify-center text-xs font-medium text-muted bg-surface/30">
                        <Sparkles className="size-3.5 text-accent" />
                        {"কোনো পরীক্ষা দেওয়া হয়নি"}
                      </div>
                    )}
                  </div>
                </div>

                {!hasTeacher && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center text-xs font-semibold text-amber-800 flex items-center gap-1.5 justify-center">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                    {"এই বিষয়ের জন্য কোনো শিক্ষক নিযুক্ত নেই।"}
                  </div>
                )}

                <div className="mt-5">
                  {hasTeacher ? (
                    <Link
                      href={path(`/student/practice/${encodeURIComponent(item.subject)}${queryString}`)}
                      className="block"
                    >
                      <button
                        type="button"
                        className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover shadow-sm"
                      >
                        {"চ্যাপ্টার সিলেক্ট করো"
                        }
                      </button>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl bg-secondary py-2.5 text-sm font-bold text-muted cursor-not-allowed border border-border"
                    >
                      {"পরীক্ষা অনুপলব্ধ"
                      }
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function StudentPracticePageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted">Loading...</p>
      </div>
    }>
      <StudentPracticeDashboard />
    </Suspense>
  );
}
