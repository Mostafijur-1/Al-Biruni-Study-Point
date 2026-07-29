"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Check,
  Flame,
  Gamepad2,
  Gift,
  LockKeyhole,
  Medal,
  Palette,
  ShieldCheck,
  Sparkles,
  Star,
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

type Quest = {
  code: string;
  period: "daily" | "weekly";
  title: string;
  description: string;
  target: number;
  progress: number;
  xp: number;
  streakFreezes: number;
  href: string;
  complete: boolean;
  claimed: boolean;
};

type Reward = {
  id: string;
  title: string;
  requiredLevel: number;
  unlocked: boolean;
  selected: boolean;
};

type HubData = {
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
    streakFreezes: number;
    streakFreezesUsed: number;
    selectedFrame: string;
    selectedTheme: string;
  };
  achievements: Array<{
    code: string;
    title: string;
    description: string;
    unlockedAt: string;
  }>;
  subjects: Array<{
    subject: string;
    xp: number;
    level: number;
    xpIntoLevel: number;
    xpPerLevel: number;
    attempts: number;
    bestAccuracy: number;
    lastAccuracy: number;
    personalBestCount: number;
  }>;
  quests: Quest[];
  leaderboard: {
    entries: Array<{
      rank: number;
      displayName: string;
      activeDays: number;
      questions: number;
      improvement: number;
      score: number;
      isCurrentStudent: boolean;
    }>;
    currentRank: number | null;
    participantCount: number;
  };
  rewards: { frames: Reward[]; themes: Reward[] };
};

const themeClass: Record<string, string> = {
  classic: "from-violet-700 via-indigo-700 to-blue-700",
  ocean: "from-cyan-700 via-sky-700 to-blue-800",
  sunset: "from-orange-600 via-rose-600 to-violet-800",
};

const frameClass: Record<string, string> = {
  classic: "ring-white/30",
  scholar: "ring-sky-300 shadow-sky-300/30",
  champion: "ring-amber-300 shadow-amber-300/40",
  cosmic: "ring-fuchsia-300 shadow-fuchsia-300/40",
};

export function StudentGameHub() {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const viewTracked = useRef(false);

  async function loadHub() {
    const result = await apiFetch<HubData>("/api/gamification/hub");
    if (result.ok && isApiSuccess(result.payload)) {
      setData(result.payload.data);
    } else {
      setMessage(
        getApiErrorMessage(result.payload, "গেম হাব এখন লোড করা যাচ্ছে না।"),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<HubData>("/api/gamification/hub");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        setData(result.payload.data);
      } else {
        setMessage(
          getApiErrorMessage(result.payload, "গেম হাব এখন লোড করা যাচ্ছে না।"),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (data && !viewTracked.current) {
      viewTracked.current = true;
      trackStudentEvent("student_game_hub_viewed", "student_game_hub", {
        level: data.profile.level,
        active_quests: data.quests.filter((quest) => !quest.claimed).length,
      });
    }
  }, [data]);

  const dailyQuests = useMemo(
    () => data?.quests.filter((quest) => quest.period === "daily") ?? [],
    [data],
  );
  const weeklyQuests = useMemo(
    () => data?.quests.filter((quest) => quest.period === "weekly") ?? [],
    [data],
  );

  async function claimQuest(quest: Quest) {
    setBusyKey(quest.code);
    setMessage("");
    const result = await apiFetch<{ alreadyClaimed: boolean }>(
      "/api/gamification/quests/claim",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questCode: quest.code }),
      },
    );
    if (result.ok && isApiSuccess(result.payload)) {
      trackStudentEvent("student_quest_claimed", "student_game_hub", {
        quest_code: quest.code,
        period: quest.period,
        xp: quest.xp,
      });
      setMessage(
        quest.streakFreezes > 0
          ? `দারুণ! ${quest.xp} XP ও ${quest.streakFreezes}টি স্ট্রিক ফ্রিজ পেয়েছেন।`
          : `দারুণ! ${quest.xp} XP সংগ্রহ হয়েছে।`,
      );
      await loadHub();
    } else {
      setMessage(
        getApiErrorMessage(result.payload, "পুরস্কারটি এখন নেওয়া যাচ্ছে না।"),
      );
    }
    setBusyKey(null);
  }

  async function equip(kind: "frame" | "theme", reward: Reward) {
    if (!reward.unlocked || reward.selected) return;
    const key = `${kind}:${reward.id}`;
    setBusyKey(key);
    setMessage("");
    const result = await apiFetch<{
      selectedFrame: string;
      selectedTheme: string;
    }>("/api/gamification/customize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [kind]: reward.id }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      trackStudentEvent("student_reward_equipped", "student_game_hub", {
        reward_type: kind,
        reward_id: reward.id,
      });
      setMessage(`${reward.title} ব্যবহার করা হয়েছে।`);
      await loadHub();
    } else {
      setMessage(
        getApiErrorMessage(result.payload, "রিওয়ার্ডটি এখন ব্যবহার করা যাচ্ছে না।"),
      );
    }
    setBusyKey(null);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="গেম হাব লোড হচ্ছে">
        <div className="h-64 animate-pulse rounded-3xl bg-violet-100" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-secondary" />
          <div className="h-72 animate-pulse rounded-2xl bg-secondary" />
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
        {message || "গেম হাব এখন লোড করা যাচ্ছে না।"}
      </div>
    );
  }

  const profile = data.profile;
  const levelProgress = profile.totalXp % 100;
  const accuracy =
    profile.totalQuestionsAnswered > 0
      ? Math.round((profile.totalCorrect / profile.totalQuestionsAnswered) * 100)
      : 0;

  return (
    <section className="space-y-6">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl sm:p-7",
          themeClass[profile.selectedTheme] ?? themeClass.classic,
        )}
      >
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-1/3 size-52 rounded-full bg-amber-300/10" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
              <Gamepad2 className="size-5" />
              শেখো · এগিয়ে যাও · উদ্‌যাপন করো
            </div>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">আপনার গেম হাব</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              প্রতিদিনের ছোট লক্ষ্য পূরণ করুন, নিজের আগের ফলকে ছাড়িয়ে যান এবং শেখার
              ধারাবাহিকতায় নতুন রিওয়ার্ড খুলুন।
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                <Flame className="mr-1.5 inline size-4 text-orange-300" />
                {profile.currentStreak} দিনের স্ট্রিক
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                <ShieldCheck className="mr-1.5 inline size-4 text-cyan-200" />
                {profile.streakFreezes}টি স্ট্রিক ফ্রিজ
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                <Target className="mr-1.5 inline size-4 text-emerald-200" />
                {accuracy}% সামগ্রিক নির্ভুলতা
              </span>
            </div>
          </div>
          <div
            className={cn(
              "mx-auto grid size-40 place-items-center rounded-full border-4 border-white/15 bg-white/10 text-center ring-8 shadow-2xl backdrop-blur",
              frameClass[profile.selectedFrame] ?? frameClass.classic,
            )}
          >
            <div>
              <Trophy className="mx-auto size-10 text-amber-300" />
              <p className="mt-1 text-3xl font-black">{profile.level}</p>
              <p className="text-2xs font-black uppercase tracking-widest text-white/70">
                লেভেল
              </p>
            </div>
          </div>
        </div>
        <div className="relative mt-6">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>{profile.totalXp} XP</span>
            <span>পরের লেভেলে আর {100 - levelProgress} XP</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-100"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-900"
        >
          <Sparkles className="mr-2 inline size-4" />
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <QuestGroup
            title="আজকের কোয়েস্ট"
            subtitle="প্রতিদিন নতুন করে শুরু হয়"
            quests={dailyQuests}
            busyKey={busyKey}
            onClaim={claimQuest}
          />
          <QuestGroup
            title="এই সপ্তাহের অভিযান"
            subtitle="সোমবার থেকে রবিবার"
            quests={weeklyQuests}
            busyKey={busyKey}
            onClaim={claimQuest}
          />
        </div>
        <Leaderboard data={data} />
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-sky-700">
              বিষয়ভিত্তিক দক্ষতা
            </p>
            <h2 className="mt-1 text-xl font-black text-primary">আপনার বিষয় লেভেল</h2>
          </div>
          <Link
            href="/student/practice"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            অনুশীলন করুন <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {data.subjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-6 text-center">
            <Zap className="mx-auto size-8 text-sky-600" />
            <p className="mt-2 font-black text-primary">প্রথম বিষয় লেভেল খুলুন</p>
            <p className="mt-1 text-sm text-muted">
              যেকোনো একটি MCQ অনুশীলন শেষ করলেই বিষয়ভিত্তিক XP শুরু হবে।
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.subjects.map((subject) => (
              <article
                key={subject.subject}
                className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-primary">{subject.subject}</p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      সেরা {Math.round(subject.bestAccuracy)}% · {subject.attempts} বার
                    </p>
                  </div>
                  <span className="rounded-lg bg-sky-700 px-2.5 py-1 text-xs font-black text-white">
                    Lv {subject.level}
                  </span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sky-100">
                  <div
                    className="h-full rounded-full bg-sky-600"
                    style={{
                      width: `${Math.round(
                        (subject.xpIntoLevel / subject.xpPerLevel) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-2xs font-bold text-muted">
                  <span>{subject.xp} বিষয় XP</span>
                  <span>{subject.personalBestCount}টি ব্যক্তিগত সেরা</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RewardLocker
          title="প্রোফাইল ফ্রেম"
          icon={<Award className="size-6 text-fuchsia-600" />}
          rewards={data.rewards.frames}
          kind="frame"
          busyKey={busyKey}
          onEquip={equip}
        />
        <RewardLocker
          title="গেম হাব থিম"
          icon={<Palette className="size-6 text-cyan-600" />}
          rewards={data.rewards.themes}
          kind="theme"
          busyKey={busyKey}
          onEquip={equip}
        />
      </div>

      <article className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <div className="flex items-center gap-2">
          <Star className="size-6 fill-amber-400 text-amber-500" />
          <h2 className="text-xl font-black text-primary">অর্জিত ব্যাজ</h2>
        </div>
        {data.achievements.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            প্রথম অনুশীলন শেষ করলেই আপনার প্রথম ব্যাজটি খুলবে।
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.achievements.map((achievement) => (
              <span
                key={achievement.code}
                title={achievement.description}
                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-900"
              >
                <Star className="size-4 fill-amber-400 text-amber-500" />
                {achievement.title}
              </span>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

function QuestGroup({
  title,
  subtitle,
  quests,
  busyKey,
  onClaim,
}: {
  title: string;
  subtitle: string;
  quests: Quest[];
  busyKey: string | null;
  onClaim: (quest: Quest) => Promise<void>;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-violet-700">
            {subtitle}
          </p>
          <h2 className="mt-1 text-xl font-black text-primary">{title}</h2>
        </div>
        <Gift className="size-7 text-violet-600" />
      </div>
      <div className="mt-4 space-y-3">
        {quests.map((quest) => {
          const percent = Math.min(
            100,
            Math.round((quest.progress / quest.target) * 100),
          );
          return (
            <div
              key={quest.code}
              className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-primary">{quest.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {quest.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-2xs font-black text-amber-800">
                  +{quest.xp} XP{quest.streakFreezes > 0 ? " + ফ্রিজ" : ""}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-violet-100">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      quest.complete ? "bg-emerald-500" : "bg-violet-600",
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-xs font-black text-muted">
                  {quest.progress}/{quest.target}
                </span>
              </div>
              <div className="mt-3 flex justify-end">
                {quest.claimed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
                    <Check className="size-4" /> সংগ্রহ হয়েছে
                  </span>
                ) : quest.complete ? (
                  <Button
                    size="sm"
                    className="rounded-lg"
                    loading={busyKey === quest.code}
                    onClick={() => void onClaim(quest)}
                  >
                    পুরস্কার নিন
                  </Button>
                ) : (
                  <Link
                    href={quest.href}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-xs font-black text-primary hover:bg-secondary"
                  >
                    শুরু করুন <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Leaderboard({ data }: { data: HubData }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-700">
            ন্যায্য সাপ্তাহিক র‌্যাঙ্কিং
          </p>
          <h2 className="mt-1 text-xl font-black text-primary">ক্লাস লিডারবোর্ড</h2>
        </div>
        <Medal className="size-7 text-amber-500" />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">
        নম্বর নয়—নিয়মিত শেখা, প্রশ্ন অনুশীলন ও নিজের উন্নতির ভিত্তিতে অবস্থান।
      </p>
      <div className="mt-4 space-y-2">
        {data.leaderboard.entries.length === 0 ? (
          <p className="rounded-xl bg-secondary p-4 text-sm text-muted">
            এই সপ্তাহে অনুশীলন শুরু করলে র‌্যাঙ্কিং দেখা যাবে।
          </p>
        ) : (
          data.leaderboard.entries.map((entry) => (
            <div
              key={`${entry.rank}-${entry.displayName}`}
              className={cn(
                "grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border p-3",
                entry.isCurrentStudent
                  ? "border-violet-300 bg-violet-50"
                  : "border-border bg-surface",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg text-xs font-black",
                  entry.rank <= 3
                    ? "bg-amber-100 text-amber-800"
                    : "bg-secondary text-muted",
                )}
              >
                {entry.rank}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-primary">
                  {entry.displayName}{entry.isCurrentStudent ? " (আপনি)" : ""}
                </p>
                <p className="text-2xs font-semibold text-muted">
                  {entry.activeDays} দিন · {entry.questions} প্রশ্ন · উন্নতি{" "}
                  {entry.improvement}%
                </p>
              </div>
              <span className="text-sm font-black text-violet-700">
                {entry.score}
              </span>
            </div>
          ))
        )}
      </div>
      <p className="mt-4 text-center text-xs font-bold text-muted">
        {data.leaderboard.currentRank
          ? `আপনার অবস্থান ${data.leaderboard.currentRank} · মোট ${data.leaderboard.participantCount} জন`
          : `${data.leaderboard.participantCount} জন এই সপ্তাহে সক্রিয়`}
      </p>
    </article>
  );
}

function RewardLocker({
  title,
  icon,
  rewards,
  kind,
  busyKey,
  onEquip,
}: {
  title: string;
  icon: ReactNode;
  rewards: Reward[];
  kind: "frame" | "theme";
  busyKey: string | null;
  onEquip: (kind: "frame" | "theme", reward: Reward) => Promise<void>;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-black text-primary">{title}</h2>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {rewards.map((reward) => {
          const key = `${kind}:${reward.id}`;
          return (
            <button
              key={reward.id}
              type="button"
              disabled={!reward.unlocked || reward.selected || busyKey === key}
              onClick={() => void onEquip(kind, reward)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition",
                reward.selected
                  ? "border-emerald-300 bg-emerald-50"
                  : reward.unlocked
                    ? "border-border bg-surface hover:border-violet-300 hover:bg-violet-50"
                    : "cursor-not-allowed border-border bg-secondary/60 opacity-70",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg",
                  reward.unlocked
                    ? "bg-violet-100 text-violet-700"
                    : "bg-slate-200 text-slate-500",
                )}
              >
                {reward.selected ? (
                  <Check className="size-5" />
                ) : reward.unlocked ? (
                  <Sparkles className="size-5" />
                ) : (
                  <LockKeyhole className="size-4" />
                )}
              </span>
              <span>
                <span className="block text-sm font-black text-primary">
                  {reward.title}
                </span>
                <span className="block text-2xs font-bold text-muted">
                  {reward.selected
                    ? "ব্যবহার হচ্ছে"
                    : reward.unlocked
                      ? "ব্যবহার করুন"
                      : `লেভেল ${reward.requiredLevel}-এ খুলবে`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
