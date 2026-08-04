"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zonedScheduleDateTimeToUtc } from "@/lib/academic-rules";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

type WorkspaceRole = "admin" | "teacher";

type Assignment = {
  id: string;
  organizationId: string;
  branchId: string;
  batchId: string;
  teacherId: string;
  subjectId: string;
  status: "active" | "ended";
  batch?: { name: string; code: string; studentClass: string };
  subject?: { name: string; nameBn: string; code: string };
  teacher?: { name: string };
  organization?: { name: string; timezone: string };
};

type Routine = {
  id: string;
  teacherAssignmentId: string;
  batchId: string;
  subjectId: string;
  teacherId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "active" | "ended";
};

type ClassSession = {
  id: string;
  batchId: string;
  subjectId: string;
  teacherId: string;
  routineSlotId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: "scheduled" | "completed" | "cancelled";
  cancellationReason?: string;
};

const weekdays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const selectClasses = "h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function dateOnly(value: string) {
  return new Date(value).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function localDateInZone(timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function assignmentLabel(assignment: Assignment, role: WorkspaceRole) {
  const batch = assignment.batch
    ? `${assignment.batch.name} (${assignment.batch.code})`
    : "ব্যাচ তথ্য নেই";
  const subject = assignment.subject?.nameBn || assignment.subject?.name || "বিষয় তথ্য নেই";
  const teacher = role === "admin" ? ` • ${assignment.teacher?.name || "শিক্ষক তথ্য নেই"}` : "";
  return `${batch} • ${subject}${teacher}`;
}

function assignmentForSession(assignments: Assignment[], session: ClassSession) {
  return assignments.find((assignment) =>
    assignment.batchId === session.batchId &&
    assignment.subjectId === session.subjectId &&
    assignment.teacherId === session.teacherId,
  );
}

function formatSessionTime(value: string, timeZone: string) {
  return new Date(value).toLocaleString("bn-BD", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function TimetableWorkspace({ role }: { role: WorkspaceRole }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<Assignment[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeRoutines, setActiveRoutines] = useState<Routine[]>([]);
  const [classSessions, setClassSessions] = useState<ClassSession[]>([]);
  const [routineStatus, setRoutineStatus] = useState<"active" | "ended">("active");
  const [sessionStatus, setSessionStatus] = useState<"scheduled" | "completed" | "cancelled">("scheduled");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"default" | "destructive" | "success">("default");

  const [routineAssignmentId, setRoutineAssignmentId] = useState("");
  const [weekday, setWeekday] = useState("1");
  const [routineStart, setRoutineStart] = useState("09:00");
  const [routineEnd, setRoutineEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [routineReason, setRoutineReason] = useState("অনুমোদিত সাপ্তাহিক রুটিন");

  const [sessionAssignmentId, setSessionAssignmentId] = useState("");
  const [sessionRoutineId, setSessionRoutineId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionStart, setSessionStart] = useState("09:00");
  const [sessionEnd, setSessionEnd] = useState("10:00");
  const [sessionReason, setSessionReason] = useState("অনুমোদিত ক্লাস সেশন");

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    const [assignmentResult, routineResult, activeRoutineResult, sessionResult] = await Promise.all([
      apiFetch<{ assignments: Assignment[] }>("/api/teacher-assignments?status=all&limit=200"),
      apiFetch<{ routines: Routine[] }>(`/api/routines?status=${routineStatus}&limit=200`),
      apiFetch<{ routines: Routine[] }>("/api/routines?status=active&limit=200"),
      apiFetch<{ classSessions: ClassSession[] }>(`/api/class-sessions?status=${sessionStatus}&limit=200`),
    ]);

    const results = [assignmentResult, routineResult, activeRoutineResult, sessionResult] as Array<{
      ok: boolean;
      payload: ApiEnvelope<unknown>;
    }>;
    const failed = results.find(
      (result) => !result.ok || result.payload.success === false,
    );
    if (failed && failed.payload.success === false) {
      setMessage(getApiErrorMessage(failed.payload, "ক্লাস রুটিন লোড করা যায়নি।"));
      setMessageVariant("destructive");
      setIsLoading(false);
      return;
    }

    if (
      isApiSuccess(assignmentResult.payload) &&
      isApiSuccess(routineResult.payload) &&
      isApiSuccess(activeRoutineResult.payload) &&
      isApiSuccess(sessionResult.payload)
    ) {
      const allAssignments = assignmentResult.payload.data.assignments;
      const nextAssignments = allAssignments.filter((assignment) => assignment.status === "active");
      setAssignments(nextAssignments);
      setAssignmentHistory(allAssignments);
      setRoutines(routineResult.payload.data.routines);
      setActiveRoutines(activeRoutineResult.payload.data.routines);
      setClassSessions(sessionResult.payload.data.classSessions);
      const firstId = nextAssignments[0]?.id || "";
      setRoutineAssignmentId((current) => current || firstId);
      setSessionAssignmentId((current) => current || firstId);
      const timeZone = nextAssignments[0]?.organization?.timezone;
      if (timeZone) setSessionDate((current) => current || localDateInZone(timeZone));
      setMessage("");
    }
    setIsLoading(false);
  }, [routineStatus, sessionStatus]);

  useEffect(() => {
    async function load() {
      await loadWorkspace();
    }
    void load();
  }, [loadWorkspace]);

  const selectedSessionAssignment = assignments.find((item) => item.id === sessionAssignmentId);
  const sessionTimeZone = selectedSessionAssignment?.organization?.timezone;
  const matchingRoutines = useMemo(
    () => activeRoutines.filter((routine) =>
      routine.teacherAssignmentId === sessionAssignmentId,
    ),
    [activeRoutines, sessionAssignmentId],
  );

  async function mutate(url: string, body: Record<string, unknown>, successMessage: string) {
    setIsSaving(true);
    setMessage("");
    const result = await apiFetch<unknown>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setMessage(getApiErrorMessage(
        result.payload,
        "পরিবর্তনটি সংরক্ষণ করা যায়নি। একাডেমিক রাইট গেট চালু আছে কি না যাচাই করুন।",
      ));
      setMessageVariant("destructive");
      setIsSaving(false);
      return false;
    }
    setIsSaving(false);
    await loadWorkspace();
    setMessage(successMessage);
    setMessageVariant("success");
    return true;
  }

  async function createRoutine(event: FormEvent) {
    event.preventDefault();
    await mutate("/api/routines", {
      action: "create",
      assignmentId: routineAssignmentId,
      weekday: Number(weekday),
      startMinute: timeToMinutes(routineStart),
      endMinute: timeToMinutes(routineEnd),
      room: room || undefined,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`).toISOString(),
      effectiveTo: effectiveTo ? new Date(`${effectiveTo}T00:00:00.000Z`).toISOString() : undefined,
      reason: routineReason,
    }, "রুটিন স্লট সংরক্ষণ হয়েছে।");
  }

  async function createSession(event: FormEvent) {
    event.preventDefault();
    if (!sessionTimeZone) {
      setMessage("নির্বাচিত অ্যাসাইনমেন্টের প্রতিষ্ঠানের টাইমজোন পাওয়া যায়নি।");
      setMessageVariant("destructive");
      return;
    }
    try {
      await mutate("/api/class-sessions", {
        action: "create",
        assignmentId: sessionAssignmentId,
        routineSlotId: sessionRoutineId || undefined,
        scheduledStart: zonedScheduleDateTimeToUtc(sessionDate, sessionStart, sessionTimeZone).toISOString(),
        scheduledEnd: zonedScheduleDateTimeToUtc(sessionDate, sessionEnd, sessionTimeZone).toISOString(),
        reason: sessionReason,
      }, "ক্লাস সেশন তৈরি হয়েছে।");
    } catch {
      setMessage("ক্লাসের তারিখ, সময় বা টাইমজোন সঠিক নয়।");
      setMessageVariant("destructive");
    }
  }

  function chooseRoutine(routineId: string) {
    setSessionRoutineId(routineId);
    const routine = activeRoutines.find((item) => item.id === routineId);
    if (routine) {
      setSessionStart(minutesToTime(routine.startMinute));
      setSessionEnd(minutesToTime(routine.endMinute));
    }
  }

  async function endRoutine(routine: Routine) {
    if (!window.confirm("এই রুটিন স্লট শেষ করবেন? পরবর্তী লিঙ্ক করা ক্লাস আগে বাতিল করতে হবে।")) return;
    const now = new Date();
    const approvedEnd = routine.effectiveTo ? new Date(routine.effectiveTo) : undefined;
    await mutate("/api/routines", {
      action: "end",
      routineSlotId: routine.id,
      effectiveAt: approvedEnd && approvedEnd < now ? approvedEnd.toISOString() : now.toISOString(),
      reason: "অনুমোদিত রুটিন সমাপ্তি",
    }, "রুটিন স্লট শেষ করা হয়েছে।");
  }

  async function transitionSession(session: ClassSession, action: "complete" | "cancel") {
    const label = action === "complete" ? "সম্পন্ন" : "বাতিল";
    if (!window.confirm(`এই ক্লাস সেশন ${label} করবেন?`)) return;
    await mutate("/api/class-sessions", {
      action,
      classSessionId: session.id,
      reason: action === "complete" ? "ক্লাস সম্পন্ন হয়েছে" : "অনুমোদিত ক্লাস বাতিল",
    }, `ক্লাস সেশন ${label} করা হয়েছে।`);
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="bg-[linear-gradient(135deg,var(--color-primary),color-mix(in_srgb,var(--color-primary)_82%,var(--color-brand-red)))] p-5 text-primary-foreground sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-yellow">Class operations</p>
              <h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">ক্লাস রুটিন ও সেশন</h1>
              <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
                অনুমোদিত ব্যাচ ও শিক্ষক অ্যাসাইনমেন্টের সময়সূচি পরিচালনা করুন। সব পরিবর্তন অডিট লগে সংরক্ষিত হয়।
              </p>
            </div>
            {role === "teacher" && (
              <Link href="/teacher/classes?view=content" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-bold ring-1 ring-white/30 transition hover:bg-white/20">
                <BookOpen className="size-4" /> ক্লাস কনটেন্ট
              </Link>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border bg-surface">
          <div className="p-3 text-center sm:p-4"><p className="text-2xl font-black text-primary">{assignments.length}</p><p className="text-xs text-muted">অ্যাসাইনমেন্ট</p></div>
          <div className="p-3 text-center sm:p-4"><p className="text-2xl font-black text-primary">{routines.length}</p><p className="text-xs text-muted">রুটিন স্লট</p></div>
          <div className="p-3 text-center sm:p-4"><p className="text-2xl font-black text-primary">{classSessions.length}</p><p className="text-xs text-muted">ক্লাস সেশন</p></div>
        </div>
      </header>

      <Alert variant="default" className="flex items-start gap-3">
        <Clock3 className="mt-0.5 size-4 shrink-0" />
        <p><strong>নিরাপদ রোলআউট:</strong> তালিকা দেখা যাবে; তৈরি বা পরিবর্তন কেবল অনুমোদিত পরিবেশে <code>ACADEMIC_WRITES_ENABLED=true</code> হলে কার্যকর হবে।</p>
      </Alert>
      {message && <Alert variant={messageVariant}>{message}</Alert>}

      <section className="space-y-4" aria-labelledby="routine-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-widest text-accent">Weekly timetable</p><h2 id="routine-heading" className="mt-1 text-xl font-black text-primary">সাপ্তাহিক রুটিন</h2></div>
          <div className="flex items-center gap-2">
            <Label htmlFor="routine-status" className="sr-only">রুটিন অবস্থা</Label>
            <select id="routine-status" value={routineStatus} onChange={(event) => setRoutineStatus(event.target.value as "active" | "ended")} className={cn(selectClasses, "w-auto")}>
              <option value="active">চলমান</option><option value="ended">শেষ হয়েছে</option>
            </select>
            <Button variant="outline" size="icon" onClick={() => void loadWorkspace()} aria-label="রুটিন আবার লোড করুন"><RefreshCw className="size-4" /></Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
          <form onSubmit={createRoutine} className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Plus className="size-4" /></span><h3 className="font-bold text-primary">নতুন রুটিন স্লট</h3></div>
            <div className="space-y-2"><Label htmlFor="routine-assignment">ব্যাচ, বিষয় ও শিক্ষক</Label><select id="routine-assignment" required value={routineAssignmentId} onChange={(event) => setRoutineAssignmentId(event.target.value)} className={selectClasses}><option value="">নির্বাচন করুন</option>{assignments.map((item) => <option key={item.id} value={item.id}>{assignmentLabel(item, role)}</option>)}</select></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="routine-day">দিন</Label><select id="routine-day" value={weekday} onChange={(event) => setWeekday(event.target.value)} className={selectClasses}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="routine-start">শুরু</Label><Input id="routine-start" type="time" required value={routineStart} onChange={(event) => setRoutineStart(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="routine-end">শেষ</Label><Input id="routine-end" type="time" required value={routineEnd} onChange={(event) => setRoutineEnd(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="routine-room">কক্ষ (ঐচ্ছিক)</Label><Input id="routine-room" maxLength={80} value={room} onChange={(event) => setRoom(event.target.value)} placeholder="যেমন: রুম ২০১" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="routine-from">কার্যকর শুরু</Label><Input id="routine-from" type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="routine-to">কার্যকর শেষ (ঐচ্ছিক)</Label><Input id="routine-to" type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="routine-reason">পরিবর্তনের কারণ</Label><Input id="routine-reason" required minLength={5} maxLength={240} value={routineReason} onChange={(event) => setRoutineReason(event.target.value)} /></div>
            <Button type="submit" loading={isSaving} disabled={!assignments.length} className="w-full"><CalendarDays className="size-4" /> রুটিন সংরক্ষণ</Button>
          </form>

          <div className="space-y-3" aria-live="polite">
            {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-secondary" /> : routines.length === 0 ? (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center"><div><CalendarDays className="mx-auto size-8 text-muted" /><p className="mt-3 font-bold text-primary">কোনো {routineStatus === "active" ? "চলমান" : "শেষ হওয়া"} রুটিন নেই</p><p className="mt-1 text-sm text-muted">অ্যাসাইনমেন্ট নির্বাচন করে প্রথম স্লট তৈরি করুন।</p></div></div>
            ) : routines.map((routine) => {
              const assignment = assignmentHistory.find((item) => item.id === routine.teacherAssignmentId);
              return <article key={routine.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-black text-primary">{weekdays[routine.weekday]}</span><span className="text-lg font-black text-primary">{minutesToTime(routine.startMinute)}–{minutesToTime(routine.endMinute)}</span></div><p className="mt-2 font-semibold text-foreground">{assignment ? assignmentLabel(assignment, role) : "অ্যাসাইনমেন্ট তথ্য পাওয়া যায়নি"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{routine.room && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{routine.room}</span>}<span>{dateOnly(routine.effectiveFrom)}–{routine.effectiveTo ? dateOnly(routine.effectiveTo) : "চলমান"}</span></div></div>
                  {routine.status === "active" && <Button variant="outline" size="sm" onClick={() => void endRoutine(routine)}><XCircle className="size-4" /> শেষ করুন</Button>}
                </div>
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="session-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-accent">Class sessions</p><h2 id="session-heading" className="mt-1 text-xl font-black text-primary">ক্লাস সেশন</h2></div><div><Label htmlFor="session-status" className="sr-only">ক্লাস সেশনের অবস্থা</Label><select id="session-status" value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value as typeof sessionStatus)} className={cn(selectClasses, "w-auto")}><option value="scheduled">নির্ধারিত</option><option value="completed">সম্পন্ন</option><option value="cancelled">বাতিল</option></select></div></div>
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
          <form onSubmit={createSession} className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><CalendarClock className="size-4" /></span><h3 className="font-bold text-primary">নতুন ক্লাস সেশন</h3></div>
            <div className="space-y-2"><Label htmlFor="session-assignment">ব্যাচ, বিষয় ও শিক্ষক</Label><select id="session-assignment" required value={sessionAssignmentId} onChange={(event) => { setSessionAssignmentId(event.target.value); setSessionRoutineId(""); }} className={selectClasses}><option value="">নির্বাচন করুন</option>{assignments.map((item) => <option key={item.id} value={item.id}>{assignmentLabel(item, role)}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="session-routine">রুটিন স্লট (ঐচ্ছিক)</Label><select id="session-routine" value={sessionRoutineId} onChange={(event) => chooseRoutine(event.target.value)} className={selectClasses}><option value="">রুটিন ছাড়া সেশন</option>{matchingRoutines.map((routine) => <option key={routine.id} value={routine.id}>{weekdays[routine.weekday]} • {minutesToTime(routine.startMinute)}–{minutesToTime(routine.endMinute)}{routine.room ? ` • ${routine.room}` : ""}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="session-date">তারিখ</Label><Input id="session-date" type="date" required value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="session-start">শুরু</Label><Input id="session-start" type="time" required value={sessionStart} onChange={(event) => setSessionStart(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="session-end">শেষ</Label><Input id="session-end" type="time" required value={sessionEnd} onChange={(event) => setSessionEnd(event.target.value)} /></div></div>
            {sessionTimeZone && <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted">সময় অঞ্চল: <strong className="text-primary">{sessionTimeZone}</strong></p>}
            <div className="space-y-2"><Label htmlFor="session-reason">পরিবর্তনের কারণ</Label><Input id="session-reason" required minLength={5} maxLength={240} value={sessionReason} onChange={(event) => setSessionReason(event.target.value)} /></div>
            <Button type="submit" loading={isSaving} disabled={!assignments.length || !sessionTimeZone} className="w-full"><CalendarClock className="size-4" /> সেশন তৈরি</Button>
          </form>

          <div className="space-y-3" aria-live="polite">
            {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-secondary" /> : classSessions.length === 0 ? (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center"><div><CalendarClock className="mx-auto size-8 text-muted" /><p className="mt-3 font-bold text-primary">কোনো {sessionStatus === "scheduled" ? "নির্ধারিত" : sessionStatus === "completed" ? "সম্পন্ন" : "বাতিল"} ক্লাস নেই</p><p className="mt-1 text-sm text-muted">রুটিন থেকে বা আলাদাভাবে ক্লাস সেশন তৈরি করুন।</p></div></div>
            ) : classSessions.map((session) => {
              const assignment = assignmentForSession(assignmentHistory, session);
              const timeZone = assignment?.organization?.timezone || "Asia/Dhaka";
              return <article key={session.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className={cn("grid size-8 place-items-center rounded-full", session.status === "completed" ? "bg-emerald-100 text-emerald-700" : session.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-secondary text-primary")}>{session.status === "completed" ? <CheckCircle2 className="size-4" /> : session.status === "cancelled" ? <XCircle className="size-4" /> : <Clock3 className="size-4" />}</span><p className="font-black text-primary">{formatSessionTime(session.scheduledStart, timeZone)}</p></div><p className="mt-2 font-semibold text-foreground">{assignment ? assignmentLabel(assignment, role) : "অ্যাসাইনমেন্ট তথ্য পাওয়া যায়নি"}</p><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted"><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />শেষ {new Date(session.scheduledEnd).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit", timeZone })}</span>{assignment?.teacher?.name && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{assignment.teacher.name}</span>}</div>{session.cancellationReason && <p className="mt-2 text-xs text-red-700">কারণ: {session.cancellationReason}</p>}</div>
                  {session.status === "scheduled" && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void transitionSession(session, "complete")}><CheckCircle2 className="size-4" /> সম্পন্ন</Button><Button variant="ghost" size="sm" onClick={() => void transitionSession(session, "cancel")}><XCircle className="size-4" /> বাতিল</Button></div>}
                </div>
              </article>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
