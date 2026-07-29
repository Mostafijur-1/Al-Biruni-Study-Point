"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Gift,
  Hand,
  HeartHandshake,
  LockKeyhole,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
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

type EncouragementKind = "high_five" | "keep_going" | "great_progress";

type CommunityData = {
  periodKey: string;
  mission: {
    code: string;
    title: string;
    description: string;
    progress: number;
    target: number;
    rewardXp: number;
    participantCount: number;
    studentContribution: number;
    complete: boolean;
    eligible: boolean;
    claimed: boolean;
  };
  members: Array<{
    memberId: string;
    displayName: string;
    contribution: number;
    activeDays: number;
    encouragements: number;
    encouragedByMe: boolean;
    isCurrentStudent: boolean;
  }>;
  inbox: Array<{
    id: string;
    from: string;
    kind: EncouragementKind;
    label: string;
    message: string;
    createdAt: string;
  }>;
  encouragementOptions: Array<{
    kind: EncouragementKind;
    label: string;
    message: string;
  }>;
};

const encouragementTone: Record<EncouragementKind, string> = {
  high_five: "border-amber-200 bg-amber-50 text-amber-800",
  keep_going: "border-sky-200 bg-sky-50 text-sky-800",
  great_progress: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function StudentCommunityHub() {
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const viewTracked = useRef(false);

  async function refresh() {
    const result = await apiFetch<CommunityData>("/api/community");
    if (result.ok && isApiSuccess(result.payload)) {
      setData(result.payload.data);
    } else {
      setMessage(
        getApiErrorMessage(
          result.payload,
          "কমিউনিটি হাব এখন লোড করা যাচ্ছে না।",
        ),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<CommunityData>("/api/community");
      if (!active) return;
      if (result.ok && isApiSuccess(result.payload)) {
        setData(result.payload.data);
      } else {
        setMessage(
          getApiErrorMessage(
            result.payload,
            "কমিউনিটি হাব এখন লোড করা যাচ্ছে না।",
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
    if (data && !viewTracked.current) {
      viewTracked.current = true;
      trackStudentEvent("student_community_viewed", "student_community", {
        class_progress: data.mission.progress,
        participants: data.mission.participantCount,
      });
    }
  }, [data]);

  async function encourage(
    memberId: string,
    displayName: string,
    kind: EncouragementKind,
  ) {
    const key = `${memberId}:${kind}`;
    setBusyKey(key);
    setMessage("");
    const result = await apiFetch<{ alreadySent: boolean }>(
      "/api/community/encourage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, kind }),
      },
    );
    if (result.ok && isApiSuccess(result.payload)) {
      trackStudentEvent("student_peer_encouraged", "student_community", {
        encouragement_kind: kind,
      });
      setMessage(`${displayName}-কে উৎসাহ পাঠানো হয়েছে।`);
      await refresh();
    } else {
      setMessage(
        getApiErrorMessage(result.payload, "উৎসাহটি এখন পাঠানো যাচ্ছে না।"),
      );
    }
    setBusyKey(null);
  }

  async function claimMission() {
    setBusyKey("mission");
    setMessage("");
    const result = await apiFetch<{ reward: { xp: number } }>(
      "/api/community/mission/claim",
      { method: "POST" },
    );
    if (result.ok && isApiSuccess(result.payload)) {
      trackStudentEvent(
        "student_class_mission_claimed",
        "student_community",
        { xp: result.payload.data.reward.xp },
      );
      setMessage(
        `অভিনন্দন! দলের সঙ্গে মিশন শেষ করে ${result.payload.data.reward.xp} XP পেয়েছেন।`,
      );
      await refresh();
    } else {
      setMessage(
        getApiErrorMessage(result.payload, "পুরস্কারটি এখন নেওয়া যাচ্ছে না।"),
      );
    }
    setBusyKey(null);
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="কমিউনিটি হাব লোড হচ্ছে">
        <div className="h-64 animate-pulse rounded-3xl bg-cyan-100" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl bg-secondary" />
          <div className="h-80 animate-pulse rounded-2xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
        {message || "কমিউনিটি হাব এখন লোড করা যাচ্ছে না।"}
      </div>
    );
  }

  const mission = data.mission;
  const progressPercent = Math.min(
    100,
    Math.round((mission.progress / mission.target) * 100),
  );
  const contributionPercent = Math.min(
    100,
    Math.round((mission.studentContribution / 10) * 100),
  );

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-800 via-sky-800 to-indigo-900 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-16 -top-16 size-60 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-1/3 size-52 rounded-full bg-cyan-300/10" />
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
            <UsersRound className="size-5" />
            একসাথে শিখি
          </div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">ক্লাস কমিউনিটি</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
            সহপাঠীদের সঙ্গে একটি লক্ষ্য পূরণ করুন, তাদের চেষ্টাকে উৎসাহ দিন এবং
            নিজের শেখার অবদান উদ্‌যাপন করুন।
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              <UsersRound className="mr-1.5 inline size-4 text-cyan-200" />
              {mission.participantCount} জন এই সপ্তাহে সক্রিয়
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              <ShieldCheck className="mr-1.5 inline size-4 text-emerald-200" />
              নম্বর ও পূর্ণ নাম গোপন
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900"
        >
          <Sparkles className="mr-2 inline size-4" />
          {message}
        </div>
      )}

      <article className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-card to-cyan-50 shadow-[var(--shadow-sm)]">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px] lg:items-center sm:p-6">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-violet-700">
                  সাপ্তাহিক ক্লাস মিশন
                </p>
                <h2 className="mt-1 text-2xl font-black text-primary">
                  {mission.title}
                </h2>
              </div>
              <Trophy className="size-9 shrink-0 text-amber-500" />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {mission.description}
            </p>
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-black text-violet-800">
                <span>ক্লাসের অগ্রগতি</span>
                <span>{mission.progress}/{mission.target} প্রশ্ন</span>
              </div>
              <div className="mt-2 h-4 overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-bold text-muted">
                {mission.complete
                  ? "ক্লাস লক্ষ্য পূরণ হয়েছে!"
                  : `আর ${Math.max(0, mission.target - mission.progress)}টি প্রশ্ন বাকি`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-primary">আপনার অবদান</span>
              <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-black text-cyan-800">
                {mission.studentContribution} প্রশ্ন
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-cyan-100">
              <div
                className="h-full rounded-full bg-cyan-600"
                style={{ width: `${contributionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-2xs font-semibold leading-5 text-muted">
              রিওয়ার্ড পেতে এই সপ্তাহে অন্তত ১০টি প্রশ্নের উত্তর দিন।
            </p>
            <div className="mt-4">
              {mission.claimed ? (
                <span className="flex items-center justify-center gap-2 rounded-xl bg-emerald-100 px-3 py-2.5 text-xs font-black text-emerald-800">
                  <Check className="size-4" /> {mission.rewardXp} XP সংগ্রহ হয়েছে
                </span>
              ) : mission.eligible ? (
                <Button
                  className="w-full rounded-xl"
                  loading={busyKey === "mission"}
                  onClick={() => void claimMission()}
                >
                  <Gift className="size-4" />
                  {mission.rewardXp} XP নিন
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/70 px-3 py-2.5 text-xs font-black text-muted">
                  <LockKeyhole className="size-4" />
                  {mission.complete
                    ? "নিজের ১০ প্রশ্ন পূরণ করুন"
                    : "ক্লাস লক্ষ্য পূরণের অপেক্ষা"}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-700">
                দলের অবদান
              </p>
              <h2 className="mt-1 text-xl font-black text-primary">
                সক্রিয় সহপাঠী
              </h2>
            </div>
            <HeartHandshake className="size-7 text-cyan-600" />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            এখানে শুধু অনুশীলনের অবদান দেখানো হয়—কারও পরীক্ষার নম্বর নয়।
          </p>

          {data.members.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-cyan-300 bg-cyan-50 p-5 text-center">
              <Zap className="mx-auto size-7 text-cyan-600" />
              <p className="mt-2 text-sm font-black text-primary">
                প্রথম অবদান রাখুন
              </p>
              <Link
                href="/student/practice"
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-800 hover:underline"
              >
                অনুশীলন শুরু করুন <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.members.map((member, index) => (
                <div
                  key={member.memberId}
                  className={cn(
                    "rounded-xl border p-3",
                    member.isCurrentStudent
                      ? "border-violet-300 bg-violet-50"
                      : "border-border bg-surface",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-100 text-xs font-black text-cyan-800">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-primary">
                        {member.displayName}{member.isCurrentStudent ? " (আপনি)" : ""}
                      </p>
                      <p className="text-2xs font-semibold text-muted">
                        {member.contribution} প্রশ্ন · {member.activeDays} সক্রিয় দিন ·{" "}
                        {member.encouragements} উৎসাহ
                      </p>
                    </div>
                    {member.encouragedByMe && !member.isCurrentStudent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-2xs font-black text-emerald-800">
                        <Check className="size-3" /> পাঠানো
                      </span>
                    )}
                  </div>
                  {!member.isCurrentStudent && !member.encouragedByMe && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/70 pt-3">
                      {data.encouragementOptions.map((option) => {
                        const key = `${member.memberId}:${option.kind}`;
                        return (
                          <button
                            key={option.kind}
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() =>
                              void encourage(
                                member.memberId,
                                member.displayName,
                                option.kind,
                              )
                            }
                            title={option.message}
                            className={cn(
                              "rounded-lg border px-2.5 py-1.5 text-2xs font-black transition hover:-translate-y-0.5 disabled:opacity-50",
                              encouragementTone[option.kind],
                            )}
                          >
                            {busyKey === key ? "পাঠানো হচ্ছে…" : option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>

        <div className="space-y-5">
          <article className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
            <div className="flex items-center gap-2">
              <MessageCircleHeart className="size-6 text-rose-600" />
              <h2 className="text-lg font-black text-primary">আপনার উৎসাহ বাক্স</h2>
            </div>
            {data.inbox.length === 0 ? (
              <p className="mt-3 rounded-xl bg-white/70 p-4 text-sm leading-6 text-muted">
                সহপাঠীর উৎসাহ এলে এখানে দেখা যাবে। আগে আপনি কাউকে একটি হাই ফাইভ
                পাঠাতে পারেন।
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {data.inbox.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-xl border p-3",
                      encouragementTone[item.kind],
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Hand className="size-4" />
                      <p className="text-xs font-black">{item.label}</p>
                    </div>
                    <p className="mt-1 text-sm font-bold">{item.message}</p>
                    <p className="mt-1 text-2xs font-semibold opacity-70">
                      {item.from} থেকে
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-6 text-emerald-700" />
              <h2 className="text-lg font-black text-primary">নিরাপদ কমিউনিটি</h2>
            </div>
            <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-emerald-900">
              <li>• শুধু একই শ্রেণির সক্রিয় শিক্ষার্থীরা এখানে থাকে।</li>
              <li>• পূর্ণ নাম ও পরীক্ষার নম্বর কখনো দেখানো হয় না।</li>
              <li>• মুক্ত বার্তার বদলে ইতিবাচক, নির্ধারিত উৎসাহ ব্যবহার হয়।</li>
              <li>• একজন সহপাঠীকে সপ্তাহে একবার উৎসাহ দেওয়া যায়।</li>
            </ul>
          </article>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-center">
        <Target className="mx-auto size-6 text-cyan-700" />
        <p className="mt-2 text-sm font-black text-primary">
          দলের পরবর্তী প্রশ্নটি আপনার হতে পারে
        </p>
        <Link
          href="/student/practice"
          className="mt-2 inline-flex items-center gap-1 text-xs font-black text-cyan-800 hover:underline"
        >
          এখনই অনুশীলন করুন <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
