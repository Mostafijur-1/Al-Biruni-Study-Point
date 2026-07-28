"use client";

import { useEffect, useState } from "react";
import { Flame, Sparkles, Star, Target, Trophy } from "lucide-react";

import { apiFetch, isApiSuccess } from "@/lib/api/client";

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
  achievements: Array<{
    code: string;
    title: string;
    description: string;
    unlockedAt: string;
  }>;
};

export function GameProfileCard() {
  const [data, setData] = useState<GameProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { ok, payload } = await apiFetch<GameProfileData>("/api/gamification/profile");
      if (active && ok && isApiSuccess(payload)) setData(payload.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-card/60" />
    );
  }
  if (!data) return null;

  const { profile, achievements } = data;
  const levelProgress = profile.totalXp % 100;
  const dailyPercent = Math.min(
    100,
    Math.round((profile.dailyProgress / profile.dailyGoalTarget) * 100),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-card to-amber-50/60 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 p-5 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-violet-700">
            <Sparkles className="size-4" />
            Learning journey
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black text-primary">Level {profile.level}</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                {profile.totalXp} total XP
              </p>
            </div>
            <Trophy className="size-10 text-amber-500" />
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-violet-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-2xs font-bold text-violet-700">
            {100 - levelProgress} XP to next level
          </p>
        </div>

        <div className="rounded-xl border border-orange-200/70 bg-white/70 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-orange-700">
            <Flame className="size-5" />
            Current streak
          </div>
          <p className="mt-2 text-3xl font-black text-primary">
            {profile.currentStreak} <span className="text-sm">days</span>
          </p>
          <p className="mt-1 text-2xs font-semibold text-muted">
            Best: {profile.longestStreak} days
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200/70 bg-white/70 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
            <Target className="size-5" />
            Daily goal
          </div>
          <p className="mt-2 text-2xl font-black text-primary">
            {profile.dailyProgress}/{profile.dailyGoalTarget}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${dailyPercent}%` }}
            />
          </div>
          <p className="mt-1 text-2xs font-semibold text-muted">
            questions answered today
          </p>
        </div>
      </div>

      {achievements.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-violet-100 bg-white/50 px-5 py-3">
          <span className="mr-1 text-2xs font-black uppercase tracking-wider text-muted">
            Recent badges
          </span>
          {achievements.slice(0, 3).map((achievement) => (
            <span
              key={achievement.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-2xs font-bold text-amber-800"
              title={achievement.description}
            >
              <Star className="size-3.5 fill-amber-400 text-amber-500" />
              {achievement.title}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
