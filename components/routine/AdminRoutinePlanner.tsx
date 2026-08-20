"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Clock3, MapPin, Pencil, Trash2, Users } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { routineDays, routineTime, type RoutineView } from "./RoutineDashboard";

type Assignment = {
  id: string;
  batchId: string;
  subjectId: string;
  teacherId: string;
  batch?: { name: string; code: string };
  subject?: { name: string; nameBn: string };
  teacher?: { name: string };
};

const fieldClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";
const shortDays = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
function minutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }

export function AdminRoutinePlanner() {
  const [routines, setRoutines] = useState<RoutineView[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [routineResult, assignmentResult] = await Promise.all([
      apiFetch<{ routines: RoutineView[] }>("/api/routines?status=active&limit=200"),
      apiFetch<{ assignments: Assignment[] }>("/api/teacher-assignments?status=active&domainOnly=true&limit=200"),
    ]);
    if (routineResult.ok && isApiSuccess(routineResult.payload)) setRoutines(routineResult.payload.data.routines);
    if (assignmentResult.ok && isApiSuccess(assignmentResult.payload)) setAssignments(assignmentResult.payload.data.assignments);
    setLoading(false);
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const selectedAssignment = useMemo(() => assignments.find((item) => item.id === assignmentId), [assignments, assignmentId]);

  async function saveRoutine(event: FormEvent) {
    event.preventDefault();
    if (!assignmentId || weekdays.length === 0) { setError(true); setMessage("ব্যাচ, বিষয় ও শিক্ষক নির্বাচন করুন।"); return; }
    setSaving(true); setMessage("");
    const days = editingId ? [weekdays[0]] : weekdays;
    const results = await Promise.all(days.map((weekday) => apiFetch<{ routine: RoutineView }>("/api/routines", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editingId ? "update" : "create", routineSlotId: editingId || undefined,
        assignmentId, weekday, startMinute: minutes(start), endMinute: minutes(end), room: room || undefined,
        reason: editingId ? "ব্যাচ ও বিষয়ভিত্তিক রুটিন আপডেট" : "ব্যাচ ও বিষয়ভিত্তিক রুটিন প্রকাশ",
      }),
    })));
    const failed = results.find((result) => !result.ok || !isApiSuccess(result.payload));
    if (failed) { setError(true); setMessage(getApiErrorMessage(failed.payload, "রুটিন সংরক্ষণ করা যায়নি।")); }
    else {
      setError(false); setMessage(editingId ? "রুটিন আপডেট হয়েছে।" : "রুটিন প্রকাশ হয়েছে। সংশ্লিষ্ট শিক্ষার্থীরা স্বয়ংক্রিয়ভাবে এটি দেখবে।");
      setEditingId(""); setAssignmentId(""); await load();
    }
    setSaving(false);
  }

  async function endRoutine(id: string) {
    if (!window.confirm("এই রুটিনটি বন্ধ করবেন? ভবিষ্যৎ ড্যাশবোর্ড থেকে এটি সরে যাবে।")) return;
    setSaving(true);
    const result = await apiFetch("/api/routines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "end", routineSlotId: id, reason: "অ্যাডমিন কর্তৃক রুটিন বন্ধ" }) });
    if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "রুটিন বন্ধ করা যায়নি।")); }
    else { setError(false); setMessage("রুটিন বন্ধ করা হয়েছে।"); await load(); }
    setSaving(false);
  }

  function editRoutine(routine: RoutineView) {
    setEditingId(routine.id); setAssignmentId(routine.teacherAssignmentId || ""); setWeekdays([routine.weekday]);
    setStart(`${String(Math.floor(routine.startMinute / 60)).padStart(2, "0")}:${String(routine.startMinute % 60).padStart(2, "0")}`);
    setEnd(`${String(Math.floor(routine.endMinute / 60)).padStart(2, "0")}:${String(routine.endMinute % 60).padStart(2, "0")}`);
    setRoom(routine.room || ""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className="space-y-6">
    <header className="rounded-3xl bg-[linear-gradient(125deg,#0b2545,#123a6b_70%,#174d82)] p-6 text-white shadow-lg sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.22em] text-brand-yellow">Academic operations</p>
      <h1 className="mt-2 text-3xl font-black">ব্যাচ ও বিষয়ভিত্তিক রুটিন</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">শিক্ষার্থী আলাদা করে নির্বাচন করতে হবে না। নির্বাচিত ব্যাচে যারা এই কোচিং বিষয়টি পড়ে, শুধু তারাই রুটিনটি পাবে।</p>
    </header>
    {message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={saveRoutine} className="h-fit space-y-5 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-md)] xl:sticky xl:top-24">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary text-white"><CalendarPlus className="size-5" /></span><div><h2 className="font-black text-primary">{editingId ? "রুটিন সম্পাদনা" : "নতুন রুটিন"}</h2><p className="text-xs text-muted">Batch + Subject + Teacher</p></div></div>
        <div className="space-y-2"><Label htmlFor="assignment">১. ব্যাচ, বিষয় ও শিক্ষক</Label><select id="assignment" className={fieldClass} required value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">নির্বাচন করুন</option>{assignments.map((item) => <option key={item.id} value={item.id}>{item.batch?.name} — {item.subject?.nameBn || item.subject?.name} — {item.teacher?.name}</option>)}</select>{selectedAssignment && <p className="rounded-xl bg-secondary p-3 text-xs text-primary">এই ব্যাচে নির্বাচিত বিষয়ের বর্তমান enrolled শিক্ষার্থীরা স্বয়ংক্রিয়ভাবে অন্তর্ভুক্ত হবে।</p>}</div>
        <fieldset><legend className="text-sm font-bold text-primary">২. সাপ্তাহিক দিন</legend><div className="mt-2 grid grid-cols-4 gap-2">{routineDays.map((day, index) => <button key={day} type="button" aria-label={day} aria-pressed={weekdays.includes(index)} onClick={() => setWeekdays((current) => editingId ? [index] : current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort())} className={cn("rounded-xl border px-2 py-2.5 text-xs font-bold", weekdays.includes(index) ? "border-primary bg-primary text-white" : "border-border bg-white text-primary")}>{shortDays[index]}</button>)}</div></fieldset>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="start">শুরু</Label><Input id="start" type="time" required value={start} onChange={(event) => setStart(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="end">শেষ</Label><Input id="end" type="time" required value={end} onChange={(event) => setEnd(event.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="room">কক্ষ (ঐচ্ছিক)</Label><Input id="room" value={room} onChange={(event) => setRoom(event.target.value)} placeholder="যেমন: রুম ২" /></div>
        <Button className="w-full" size="lg" disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে…" : editingId ? "পরিবর্তন সংরক্ষণ করুন" : "রুটিন প্রকাশ করুন"}</Button>
      </form>
      <section className="space-y-4">{loading ? <div className="h-64 animate-pulse rounded-3xl bg-secondary" /> : routines.length === 0 ? <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">এখনো কোনো রুটিন নেই।</div> : routineDays.map((day, index) => { const items = routines.filter((item) => item.weekday === index); if (!items.length) return null; return <div key={day} className="rounded-3xl border border-border bg-card p-5"><h3 className="mb-3 font-black text-primary">{day}</h3><div className="space-y-3">{items.map((item) => <article key={item.id} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[110px_1fr_auto] sm:items-center"><div><p className="text-lg font-black text-brand-red">{routineTime(item.startMinute)}</p><p className="text-xs text-muted">থেকে {routineTime(item.endMinute)}</p></div><div><p className="font-black text-primary">{item.subject?.nameBn || item.subject?.name}</p><p className="mt-1 text-sm text-muted">{item.batch?.name} • {item.teacher.name}</p><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted"><span className="inline-flex items-center gap-1"><Users className="size-3.5" />{item.eligibleStudentCount ?? 0} জন eligible</span>{item.room && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{item.room}</span>}<span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />সাপ্তাহিক</span></div></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => editRoutine(item)}><Pencil className="size-4" /> সম্পাদনা</Button><Button type="button" variant="outline" size="sm" onClick={() => void endRoutine(item.id)}><Trash2 className="size-4" /> বন্ধ</Button></div></article>)}</div></div>; })}</section>
    </div>
  </div>;
}
