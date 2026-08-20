"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";

import { apiFetch, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export type RoutineView = {
  id: string;
  teacherAssignmentId?: string;
  targeting?: "batch-subject" | "legacy-students";
  eligibleStudentCount?: number;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  teacher: { id: string; name: string };
  students: Array<{ id: string; name: string; reference?: string }>;
  batch?: { name: string; code: string };
  subject?: { name: string; nameBn: string };
};

export const routineDays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

export function routineTime(minute: number) {
  return new Date(Date.UTC(2020, 0, 1, Math.floor(minute / 60), minute % 60)).toLocaleTimeString("bn-BD", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function RoutineDashboard({ compact = false }: { compact?: boolean }) {
  const [routines, setRoutines] = useState<RoutineView[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().getDay();

  useEffect(() => {
    let active = true;
    void apiFetch<{ routines: RoutineView[] }>("/api/routines?status=active&limit=200").then((result) => {
      if (active && result.ok && isApiSuccess(result.payload)) setRoutines(result.payload.data.routines);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const todayRoutines = useMemo(() => routines.filter((item) => item.weekday === today), [routines, today]);
  const nextToday = todayRoutines.find((item) => item.endMinute >= new Date().getHours() * 60 + new Date().getMinutes());

  if (loading) return <div className="h-44 animate-pulse rounded-3xl bg-secondary" />;

  return (
    <section className="space-y-5" aria-labelledby="my-routine-title">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-md)]">
        <div className="bg-[linear-gradient(125deg,#0b2545,#123a6b_65%,#174d82)] p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-brand-yellow">আজকের ক্লাস</p>
              <h2 id="my-routine-title" className="mt-2 text-2xl font-black">{routineDays[today]}</h2>
              <p className="mt-1 text-sm text-white/70">সাপ্তাহিক রুটিন থেকে স্বয়ংক্রিয়ভাবে দেখানো হচ্ছে</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right ring-1 ring-white/15">
              <p className="text-2xl font-black">{todayRoutines.length}</p>
              <p className="text-xs text-white/70">টি ক্লাস আজ</p>
            </div>
          </div>
          {nextToday ? (
            <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 text-primary sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-xs font-bold text-brand-red">পরবর্তী ক্লাস</p>
                <p className="mt-1 text-lg font-black">{nextToday.subject?.nameBn || nextToday.subject?.name || "ক্লাস"}</p>
                <p className="mt-1 text-sm text-muted">{nextToday.batch?.name ? `${nextToday.batch.name} • ` : ""}{nextToday.teacher.name}</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 font-black">
                <Clock3 className="size-4" /> {routineTime(nextToday.startMinute)}
              </div>
            </div>
          ) : <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-white/80">আজ আর কোনো নির্ধারিত ক্লাস নেই।</p>}
        </div>

        {!compact && (
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              <h3 className="font-black text-primary">সম্পূর্ণ সাপ্তাহিক রুটিন</h3>
            </div>
            {routines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">অ্যাডমিন এখনো আপনার জন্য কোনো রুটিন তৈরি করেননি।</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {routineDays.map((day, dayIndex) => {
                  const items = routines.filter((item) => item.weekday === dayIndex);
                  if (!items.length) return null;
                  return <article key={day} className={cn("rounded-2xl border p-4", dayIndex === today ? "border-brand-blue bg-brand-blue-light/60" : "border-border bg-surface")}>
                    <div className="flex items-center justify-between"><h4 className="font-black text-primary">{day}</h4>{dayIndex === today && <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-white">আজ</span>}</div>
                    <div className="mt-3 space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-border/70">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-black text-primary">{item.subject?.nameBn || item.subject?.name}</p><p className="mt-0.5 text-xs text-muted">{item.batch?.name ? `${item.batch.name} • ` : ""}{item.teacher.name}</p></div><span className="whitespace-nowrap text-sm font-black text-brand-red">{routineTime(item.startMinute)}–{routineTime(item.endMinute)}</span></div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">{item.room && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{item.room}</span>}<span className="inline-flex items-center gap-1"><Users className="size-3.5" />{item.students.length} জন শিক্ষার্থী</span></div>
                    </div>)}</div>
                  </article>;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
