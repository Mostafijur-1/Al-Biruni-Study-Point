"use client";

import { useEffect, useMemo, useRef, useState, type Key, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Flame,
  Gamepad2,
  GraduationCap,
  LineChart,
  PlayCircle,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  UsersRound,
  Swords,
} from "lucide-react";

import { apiFetch, isApiSuccess } from "@/lib/api/client";
import { trackStudentEvent } from "@/lib/analytics/client";
import { DailyLearningPlanCard } from "@/components/learning/DailyLearningPlanCard";
import { useSession } from "@/lib/hooks/use-session";
import { cn } from "@/lib/utils";

type GameProfileData = {
  profile: {
    totalXp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    dailyProgress: number;
    dailyGoalTarget: number;
    testsCompleted: number;
    totalQuestionsAnswered: number;
    totalCorrect: number;
  };
};

type SubjectStatus = {
  subject: string;
  chapters: Array<{ name: string; hasMcqs: boolean }>;
  lastResult: {
    percentage: number;
    submittedAt: string;
  } | null;
};

type StudentExam = {
  _id: string;
  title: string;
  subject: string;
  hasSubmitted: boolean;
  createdAt: string;
};

type Assignment = {
  _id: string;
  title: string;
  dueDate?: string;
};

type Video = {
  _id: string;
  title: string;
  description?: string;
};

type DashboardData = {
  game: GameProfileData | null;
  subjects: SubjectStatus[];
  exams: StudentExam[];
  assignments: Assignment[];
  videos: Video[];
};

const emptyData: DashboardData = {
  game: null,
  subjects: [],
  exams: [],
  assignments: [],
  videos: [],
};

function firstName(name?: string) {
  return name?.trim().split(/\s+/)[0] || "শিক্ষার্থী";
}

function classLabel(studentClass?: string) {
  const labels: Record<string, string> = {
    "class-9": "নবম শ্রেণি",
    "class-10": "দশম শ্রেণি",
    "class-11": "একাদশ শ্রেণি",
    "class-12": "দ্বাদশ শ্রেণি",
  };
  return studentClass ? labels[studentClass] : undefined;
}

function dashboardLink(
  href: string,
  action: string,
  className?: string,
  children?: ReactNode,
  key?: Key,
) {
  return (
    <Link
      key={key}
      href={href}
      onClick={() =>
        trackStudentEvent("student_dashboard_action_clicked", "student_home", {
          action,
          destination: href,
        })
      }
      className={className}
    >
      {children}
    </Link>
  );
}

export function StudentHomeDashboard() {
  const router = useRouter();
  const { user, checking } = useSession({ listenToAuthChanges: true });
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [hasAnyData, setHasAnyData] = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    if (!checking && !user) {
      router.replace("/student/practice");
    }
  }, [checking, router, user]);

  useEffect(() => {
    if (checking || !user) return;

    let active = true;
    void (async () => {
      setLoading(true);
      const [gameResult, practiceResult, examsResult, assignmentsResult, videosResult] =
        await Promise.all([
          apiFetch<GameProfileData>("/api/gamification/profile"),
          apiFetch<{ status: SubjectStatus[] }>("/api/mcq/practice/status"),
          apiFetch<{ exams: StudentExam[] }>("/api/mcq/exams"),
          apiFetch<{ assignments: Assignment[] }>("/api/cq/assignments?scope=student"),
          apiFetch<{ videos: Video[] }>("/api/videos?scope=student"),
        ]);

      if (!active) return;

      const nextData: DashboardData = {
        game:
          gameResult.ok && isApiSuccess(gameResult.payload)
            ? gameResult.payload.data
            : null,
        subjects:
          practiceResult.ok && isApiSuccess(practiceResult.payload)
            ? practiceResult.payload.data.status
            : [],
        exams:
          examsResult.ok && isApiSuccess(examsResult.payload)
            ? examsResult.payload.data.exams
            : [],
        assignments:
          assignmentsResult.ok && isApiSuccess(assignmentsResult.payload)
            ? assignmentsResult.payload.data.assignments
            : [],
        videos:
          videosResult.ok && isApiSuccess(videosResult.payload)
            ? videosResult.payload.data.videos
            : [],
      };

      setData(nextData);
      setHasAnyData(
        Boolean(nextData.game) ||
          nextData.subjects.length > 0 ||
          nextData.exams.length > 0 ||
          nextData.assignments.length > 0 ||
          nextData.videos.length > 0,
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [checking, user]);

  useEffect(() => {
    if (!loading && user && !viewTracked.current) {
      viewTracked.current = true;
      trackStudentEvent("student_dashboard_viewed", "student_home", {
        has_data: hasAnyData,
        student_class: user.studentClass ?? "unknown",
      });
    }
  }, [hasAnyData, loading, user]);

  const recommendedSubject = useMemo(() => {
    return data.subjects
      .filter((item) => item.chapters.some((chapter) => chapter.hasMcqs))
      .sort((a, b) => {
        if (!a.lastResult) return -1;
        if (!b.lastResult) return 1;
        return a.lastResult.percentage - b.lastResult.percentage;
      })[0];
  }, [data.subjects]);

  const profile = data.game?.profile;
  const dailyGoal = profile?.dailyGoalTarget ?? 10;
  const dailyProgress = Math.min(profile?.dailyProgress ?? 0, dailyGoal);
  const dailyComplete = dailyProgress >= dailyGoal;
  const dailyPercent = Math.round((dailyProgress / dailyGoal) * 100);
  const overallAccuracy =
    profile && profile.totalQuestionsAnswered > 0
      ? Math.round((profile.totalCorrect / profile.totalQuestionsAnswered) * 100)
      : 0;
  const availableExams = data.exams.filter((exam) => !exam.hasSubmitted);
  const nextAssignment = [...data.assignments]
    .filter((assignment) => !assignment.dueDate || new Date(assignment.dueDate) >= new Date())
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })[0];
  const dailyHref = recommendedSubject
    ? `/student/practice/${encodeURIComponent(recommendedSubject.subject)}?count=10`
    : "/student/practice";
  const studentLevel =
    user?.studentClass === "class-11" || user?.studentClass === "class-12"
      ? "HSC"
      : "SSC";

  if (checking || loading) {
    return (
      <div className="space-y-5" aria-label="ড্যাশবোর্ড লোড হচ্ছে">
        <div className="h-52 animate-pulse rounded-3xl bg-primary/10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-secondary/70" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl bg-secondary/70" />
          <div className="h-56 animate-pulse rounded-2xl bg-secondary/70" />
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-5 py-6 text-primary-foreground shadow-[var(--shadow-lg)] sm:px-7 sm:py-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-brand-blue/20"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-20 size-48 rounded-full bg-brand-yellow/15"
          aria-hidden
        />
        <div className="relative max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-yellow">
            <Sparkles className="size-4" />
            <span>আজকের শেখার যাত্রা</span>
            {classLabel(user?.studentClass) && (
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-white">
                {classLabel(user?.studentClass)}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-2xl font-black sm:text-4xl">
            স্বাগতম, {firstName(user?.name)}!
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
            ছোট একটি লক্ষ্য দিয়ে শুরু করুন। আজকের অনুশীলন শেষ করলেই আপনার
            ধারাবাহিকতা ও XP দুটোই বাড়বে।
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {dashboardLink(
              dailyHref,
              "daily_mission",
              "inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-yellow px-5 py-3 text-sm font-black text-primary transition hover:bg-yellow-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              <>
                <Target className="size-4" />
                {dailyComplete ? "আরও অনুশীলন করুন" : "আজকের ১০ প্রশ্ন শুরু করুন"}
                <ArrowRight className="size-4" />
              </>,
            )}
            <span className="text-xs font-semibold text-white/70">
              {dailyComplete
                ? "আজকের লক্ষ্য সম্পন্ন—দারুণ!"
                : `লক্ষ্য পূরণে আর ${Math.max(0, dailyGoal - dailyProgress)}টি প্রশ্ন`}
            </span>
          </div>
        </div>
      </div>

      {!hasAnyData && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          আপনার জন্য নতুন শেখার কন্টেন্ট প্রস্তুত হচ্ছে। এর মধ্যে অনুশীলনের
          বিষয়গুলো দেখে একটি ছোট পরীক্ষা শুরু করতে পারেন।
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-800">ধারাবাহিকতা</span>
            <Flame className="size-5 text-orange-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-primary">
            {profile?.currentStreak ?? 0} দিন
          </p>
          <p className="mt-1 text-xs text-muted">
            সর্বোচ্চ {profile?.longestStreak ?? 0} দিন
          </p>
        </article>

        <article className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-800">লার্নিং লেভেল</span>
            <Trophy className="size-5 text-violet-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-primary">
            লেভেল {profile?.level ?? 1}
          </p>
          <p className="mt-1 text-xs text-muted">{profile?.totalXp ?? 0} মোট XP</p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">আজকের লক্ষ্য</span>
            <Target className="size-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-primary">
            {dailyProgress}/{dailyGoal}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${dailyPercent}%` }}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-800">সামগ্রিক নির্ভুলতা</span>
            <LineChart className="size-5 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-primary">{overallAccuracy}%</p>
          <p className="mt-1 text-xs text-muted">
            {profile?.totalQuestionsAnswered ?? 0}টি প্রশ্নের ভিত্তিতে
          </p>
        </article>
      </div>

      <DailyLearningPlanCard compact />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-brand-red">
                পরবর্তী সেরা কাজ
              </p>
              <h2 className="mt-2 text-xl font-black text-primary">
                {dailyComplete ? "আজকের লক্ষ্য ধরে রাখুন" : "১০ প্রশ্নের দৈনিক মিশন"}
              </h2>
            </div>
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl",
                dailyComplete
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-brand-yellow/20 text-primary",
              )}
            >
              {dailyComplete ? (
                <CheckCircle2 className="size-6" />
              ) : (
                <Target className="size-6" />
              )}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">
            {recommendedSubject
              ? `${recommendedSubject.subject} থেকে নির্বাচিত প্রশ্ন দিয়ে আজকের শেখা শুরু করুন।`
              : "আপনার শ্রেণির যেকোনো বিষয় বেছে নিয়ে আজকের অনুশীলন শুরু করুন।"}
          </p>
          <div className="mt-5">
            {dashboardLink(
              dailyHref,
              "recommended_practice",
              "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover",
              <>
                <PlayCircle className="size-4" />
                অনুশীলন শুরু করুন
              </>,
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
          <p className="text-xs font-black uppercase tracking-widest text-accent-foreground">
            সামনে যা আছে
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
              <GraduationCap className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">
                  {availableExams.length}টি নতুন পরীক্ষা
                </p>
                <p className="truncate text-xs text-muted">
                  {availableExams[0]?.title || "শিক্ষকের নতুন পরীক্ষার অপেক্ষায়"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3">
              <CalendarClock className="size-5 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-primary">
                  {nextAssignment?.title || "কোনো আসন্ন অ্যাসাইনমেন্ট নেই"}
                </p>
                <p className="text-xs text-muted">
                  {nextAssignment?.dueDate
                    ? `জমার তারিখ ${new Date(nextAssignment.dueDate).toLocaleDateString("bn-BD")}`
                    : "নতুন কাজ এলে এখানে দেখা যাবে"}
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-brand-blue">
              দ্রুত শুরু করুন
            </p>
            <h2 className="mt-1 text-xl font-black text-primary">আপনার শেখার জায়গা</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              href: `/student/courses?level=${studentLevel}`,
              action: "courses",
              title: "কোর্স ও ক্লাস",
              description: data.videos[0]?.title || "ভিডিও ক্লাস ও শেখার উপকরণ",
              icon: BookOpen,
              tone: "bg-sky-100 text-sky-700",
            },
            {
              href: "/student/assignments",
              action: "assignments",
              title: "অ্যাসাইনমেন্ট",
              description: nextAssignment?.title || "প্রকাশিত CQ কাজ দেখুন",
              icon: ClipboardList,
              tone: "bg-amber-100 text-amber-700",
            },
            {
              href: "/student/exams",
              action: "exams",
              title: "MCQ পরীক্ষা",
              description: `${availableExams.length}টি পরীক্ষা বাকি`,
              icon: GraduationCap,
              tone: "bg-violet-100 text-violet-700",
            },
            {
              href: "/student/game",
              action: "game_hub",
              title: "গেম হাব",
              description: "কোয়েস্ট, রিওয়ার্ড ও ক্লাসের শেখার র‌্যাঙ্কিং",
              icon: Gamepad2,
              tone: "bg-fuchsia-100 text-fuchsia-700",
            },
            {
              href: "/student/challenge",
              action: "daily_challenge",
              title: "ডেইলি চ্যালেঞ্জ",
              description: "৯০ সেকেন্ডে ৫ প্রশ্ন—দ্রুত খেলুন ও সমাধান শিখুন",
              icon: Swords,
              tone: "bg-orange-100 text-orange-700",
            },
            {
              href: "/student/focus",
              action: "focus_studio",
              title: "ফোকাস স্টুডিও",
              description: "১৫/২৫/৪৫ মিনিটের মনোযোগী পড়ার সেশন",
              icon: TimerReset,
              tone: "bg-teal-100 text-teal-700",
            },
            {
              href: "/student/goals",
              action: "weekly_goals",
              title: "সাপ্তাহিক লক্ষ্য",
              description: "নিজের লক্ষ্য বেছে নিন এবং স্বয়ংক্রিয় অগ্রগতি দেখুন",
              icon: Target,
              tone: "bg-rose-100 text-rose-700",
            },
            {
              href: "/student/community",
              action: "community",
              title: "ক্লাস কমিউনিটি",
              description: "দলের মিশনে অবদান দিন ও সহপাঠীকে উৎসাহ পাঠান",
              icon: UsersRound,
              tone: "bg-cyan-100 text-cyan-700",
            },
            {
              href: "/student/results",
              action: "results",
              title: "ফলাফল ও অগ্রগতি",
              description: "স্কোর ও শিক্ষকের মতামত দেখুন",
              icon: LineChart,
              tone: "bg-emerald-100 text-emerald-700",
            },
          ].map(({ href, action, title, description, icon: Icon, tone }) =>
            dashboardLink(
              href,
              action,
              "group rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-md)]",
              <div className="flex items-start gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-black text-primary">
                    {title}
                    <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                    {description}
                  </span>
                </span>
              </div>,
              action,
            ),
          )}
        </div>
      </div>
    </section>
  );
}
