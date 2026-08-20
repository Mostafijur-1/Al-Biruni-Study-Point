"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, Clock3, MapPin, Pencil, Search, Trash2, UserRound, Users, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { routineDays, routineTime, type RoutineView } from "./RoutineDashboard";

type Person = { id: string; name: string; reference?: string; studentClass?: string };
type Assignment = {
  id: string;
  teacherId: string;
  batchId: string;
  effectiveFrom: string;
  batch?: { name: string; code: string; studentClass: string };
  subject?: { name: string; nameBn: string; code: string };
  teacher?: { name: string };
};

const fieldClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";
const today = new Date().toISOString().slice(0, 10);

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function AdminRoutinePlanner() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [routines, setRoutines] = useState<RoutineView[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Person[]>([]);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [assignmentResult, routineResult] = await Promise.all([
      apiFetch<{ assignments: Assignment[] }>("/api/teacher-assignments?status=active&limit=200"),
      apiFetch<{ routines: RoutineView[] }>("/api/routines?status=active&limit=200"),
    ]);
    if (assignmentResult.ok && isApiSuccess(assignmentResult.payload)) setAssignments(assignmentResult.payload.data.assignments);
    if (routineResult.ok && isApiSuccess(routineResult.payload)) setRoutines(routineResult.payload.data.routines);
    setLoading(false);
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const result = await apiFetch<{ users: Person[] }>(`/api/admin/routine-participants?role=teacher&q=${encodeURIComponent(teacherQuery)}`);
      if (result.ok && isApiSuccess(result.payload)) setTeachers(result.payload.data.users);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [teacherQuery]);

  useEffect(() => {
    const batchId = assignments.find((item) => item.id === assignmentId)?.batchId;
    if (studentQuery.trim().length < 1 || !batchId) return;
    const timer = window.setTimeout(async () => {
      const result = await apiFetch<{ users: Person[] }>(`/api/admin/routine-participants?role=student&batchId=${batchId}&q=${encodeURIComponent(studentQuery)}`);
      if (result.ok && isApiSuccess(result.payload)) setStudents(result.payload.data.users);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [assignmentId, assignments, studentQuery]);

  const teacherAssignments = useMemo(() => assignments.filter((item) => item.teacherId === teacherId), [assignments, teacherId]);

  async function createRoutine(event: FormEvent) {
    event.preventDefault();
    if (!assignmentId || !selectedStudents.length) {
      setError(true); setMessage("শিক্ষকের বিষয়/ব্যাচ এবং অন্তত একজন শিক্ষার্থী নির্বাচন করুন।"); return;
    }
    setSaving(true); setMessage("");
    const result = await apiFetch<{ routine: RoutineView }>("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editingId ? "update" : "create",
        routineSlotId: editingId || undefined,
        assignmentId,
        studentIds: selectedStudents.map((item) => item.id),
        weekday,
        startMinute: minutes(start),
        endMinute: minutes(end),
        room: room || undefined,
        effectiveFrom: `${effectiveFrom}T00:00:00.000Z`,
        effectiveTo: effectiveTo ? `${effectiveTo}T00:00:00.000Z` : undefined,
        reason: "অ্যাডমিন অনুমোদিত সাপ্তাহিক রুটিন",
      }),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true); setMessage(getApiErrorMessage(result.payload, "রুটিনটি তৈরি করা যায়নি।"));
    } else {
      setError(false); setMessage(editingId ? "রুটিন আপডেট হয়েছে এবং সবাইকে তাৎক্ষণিক নোটিফিকেশন পাঠানো হয়েছে।" : "রুটিন প্রকাশ হয়েছে এবং সবাইকে তাৎক্ষণিক নোটিফিকেশন পাঠানো হয়েছে।");
      setEditingId(""); setSelectedStudents([]); setStudentQuery(""); await load();
    }
    setSaving(false);
  }

  async function endRoutine(id: string) {
    if (!window.confirm("এই রুটিনটি বন্ধ করবেন? এটি শিক্ষক ও শিক্ষার্থীর ড্যাশবোর্ড থেকে সরে যাবে।")) return;
    setSaving(true);
    const result = await apiFetch("/api/routines", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", routineSlotId: id, effectiveAt: new Date().toISOString(), reason: "অ্যাডমিন কর্তৃক রুটিন বন্ধ" }),
    });
    if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "রুটিনটি বন্ধ করা যায়নি।")); }
    else { setError(false); setMessage("রুটিন বন্ধ করা হয়েছে।"); await load(); }
    setSaving(false);
  }

  function addStudent(student: Person) {
    if (!selectedStudents.some((item) => item.id === student.id)) setSelectedStudents((items) => [...items, student]);
    setStudentQuery(""); setStudents([]);
  }

  function editRoutine(routine: RoutineView) {
    setEditingId(routine.id);
    setTeacherId(routine.teacher.id);
    setTeacherQuery(routine.teacher.name);
    setAssignmentId(routine.teacherAssignmentId);
    setSelectedStudents(routine.students);
    setWeekday(routine.weekday);
    setStart(`${String(Math.floor(routine.startMinute / 60)).padStart(2, "0")}:${String(routine.startMinute % 60).padStart(2, "0")}`);
    setEnd(`${String(Math.floor(routine.endMinute / 60)).padStart(2, "0")}:${String(routine.endMinute % 60).padStart(2, "0")}`);
    setRoom(routine.room || "");
    setEffectiveFrom(routine.effectiveFrom.slice(0, 10));
    setEffectiveTo(routine.effectiveTo?.slice(0, 10) || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#0b2545,#123a6b_70%,#174d82)] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-brand-yellow">Academic operations</p><h1 className="mt-2 text-3xl font-black">সাপ্তাহিক রুটিন প্ল্যানার</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">এক জায়গা থেকে শিক্ষক, শিক্ষার্থী, বিষয়, দিন ও সময় নির্ধারণ করুন। প্রকাশের পর সবার ড্যাশবোর্ড এবং রিমাইন্ডার স্বয়ংক্রিয়।</p></div><div className="rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-white/15"><p className="text-2xl font-black">{routines.length}</p><p className="text-xs text-white/70">সক্রিয় ক্লাস</p></div></div>
      </header>

      {message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={createRoutine} className="h-fit space-y-5 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-md)] xl:sticky xl:top-24">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary text-white"><CalendarPlus className="size-5" /></span><div><h2 className="font-black text-primary">{editingId ? "রুটিন সম্পাদনা" : "নতুন রুটিন"}</h2><p className="text-xs text-muted">{editingId ? "পরিবর্তন করলে সংশ্লিষ্ট সবাই নোটিফিকেশন পাবেন" : "প্রয়োজনীয় তথ্য ধাপে ধাপে দিন"}</p></div></div>

          <div className="space-y-2"><Label htmlFor="teacher-search">১. শিক্ষক খুঁজুন</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted" /><Input id="teacher-search" value={teacherQuery} onChange={(e) => setTeacherQuery(e.target.value)} className="pl-9" placeholder="নাম বা রেফারেন্স" /></div><div className="max-h-40 space-y-1 overflow-y-auto">{teachers.map((person) => <button key={person.id} type="button" onClick={() => { setTeacherId(person.id); setAssignmentId(""); setTeacherQuery(person.name); setTeachers([]); }} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm", teacherId === person.id ? "border-primary bg-secondary" : "border-border hover:bg-secondary/50")}><UserRound className="size-4" /><span className="min-w-0 flex-1"><b>{person.name}</b>{person.reference && <small className="ml-2 text-muted">#{person.reference}</small>}</span>{teacherId === person.id && <Check className="size-4" />}</button>)}</div></div>

          <div className="space-y-2"><Label htmlFor="assignment">২. বিষয় ও ব্যাচ</Label><select id="assignment" className={fieldClass} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} disabled={!teacherId}><option value="">নির্বাচন করুন</option>{teacherAssignments.map((item) => <option key={item.id} value={item.id}>{item.subject?.nameBn || item.subject?.name} • {item.batch?.name} ({item.batch?.code})</option>)}</select>{teacherId && !teacherAssignments.length && <p className="text-xs text-brand-red">এই শিক্ষকের কোনো সক্রিয় বিষয়/ব্যাচ অ্যাসাইনমেন্ট নেই।</p>}</div>

          <div className="space-y-2"><Label htmlFor="student-search">৩. শিক্ষার্থী যোগ করুন</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted" /><Input id="student-search" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} className="pl-9" placeholder="নাম বা রেফারেন্স লিখুন" /></div>{students.length > 0 && <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-white p-1">{students.map((student) => <button key={student.id} type="button" onClick={() => addStudent(student)} className="flex w-full items-center justify-between rounded-lg p-2.5 text-left text-sm hover:bg-secondary"><span><b>{student.name}</b><small className="ml-2 text-muted">{student.reference ? `#${student.reference}` : student.studentClass}</small></span><span className="text-xs font-bold text-primary">যোগ করুন</span></button>)}</div>}<div className="flex flex-wrap gap-2">{selectedStudents.map((student) => <span key={student.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white">{student.name}{student.reference && ` · ${student.reference}`}<button type="button" aria-label={`${student.name} বাদ দিন`} onClick={() => setSelectedStudents((items) => items.filter((item) => item.id !== student.id))}><X className="size-3.5" /></button></span>)}</div></div>

          <fieldset><legend className="text-sm font-bold text-primary">৪. সাপ্তাহিক দিন</legend><div className="mt-2 grid grid-cols-4 gap-2">{routineDays.map((day, index) => <button key={day} type="button" onClick={() => setWeekday(index)} className={cn("rounded-xl border px-2 py-2.5 text-xs font-bold", weekday === index ? "border-primary bg-primary text-white" : "border-border bg-white text-primary hover:bg-secondary")}>{day.slice(0, 3)}</button>)}</div></fieldset>

          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="start">শুরু</Label><Input id="start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="end">শেষ</Label><Input id="end" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} /></div></div>
          <div className="space-y-2"><Label htmlFor="room">কক্ষ/লিংক (ঐচ্ছিক)</Label><Input id="room" value={room} maxLength={80} onChange={(e) => setRoom(e.target.value)} placeholder="যেমন: রুম ২০১" /></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="from">কার্যকর শুরু</Label><Input id="from" type="date" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="to">শেষ (ঐচ্ছিক)</Label><Input id="to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} /></div></div>
          <Button className="w-full" size="lg" disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে…" : editingId ? "পরিবর্তন সংরক্ষণ করুন" : "রুটিন প্রকাশ করুন"}</Button>
          <p className="text-center text-[11px] leading-5 text-muted">প্রকাশের পর শিক্ষক ও শিক্ষার্থীরা সঙ্গে সঙ্গে দেখতে পাবেন। আগের রাত ৯:৩০ এবং ক্লাসের ২ ঘণ্টা আগে পুশ রিমাইন্ডার যাবে।</p>
        </form>

        <section className="space-y-4"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Live timetable</p><h2 className="mt-1 text-xl font-black text-primary">বর্তমান সাপ্তাহিক রুটিন</h2></div>{loading ? <div className="h-64 animate-pulse rounded-3xl bg-secondary" /> : routines.length === 0 ? <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-border bg-card p-8 text-center"><div><CalendarPlus className="mx-auto size-10 text-muted" /><p className="mt-3 font-black text-primary">এখনো কোনো রুটিন নেই</p><p className="mt-1 text-sm text-muted">বাম পাশের ফর্ম থেকে প্রথম রুটিন তৈরি করুন।</p></div></div> : <div className="space-y-4">{routineDays.map((day, index) => { const items = routines.filter((item) => item.weekday === index); if (!items.length) return null; return <div key={day} className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-primary">{day}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">{items.length} ক্লাস</span></div><div className="space-y-3">{items.map((item) => <article key={item.id} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[110px_1fr_auto] sm:items-center"><div><p className="text-lg font-black text-brand-red">{routineTime(item.startMinute)}</p><p className="text-xs text-muted">থেকে {routineTime(item.endMinute)}</p></div><div className="min-w-0 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"><p className="font-black text-primary">{item.subject?.nameBn || item.subject?.name}</p><p className="mt-1 text-sm text-muted">{item.batch?.name} • {item.teacher.name}</p><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted"><span className="inline-flex items-center gap-1"><Users className="size-3.5" />{item.students.length} জন</span>{item.room && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{item.room}</span>}<span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />সাপ্তাহিক</span></div></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => editRoutine(item)} disabled={saving}><Pencil className="size-4" /> সম্পাদনা</Button><Button type="button" variant="outline" size="sm" onClick={() => void endRoutine(item.id)} disabled={saving}><Trash2 className="size-4" /> বন্ধ</Button></div></article>)}</div></div>; })}</div>}</section>
      </div>
    </div>
  );
}
