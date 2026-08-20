"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, UserCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Session = { id: string; batchId: string; subjectId: string; scheduledStart: string; scheduledEnd: string; status: string };
type Assignment = { batchId: string; subjectId: string; batch?: { name: string }; subject?: { name: string; nameBn: string } };
type Sheet = { id: string; classSessionId: string; status: "draft" | "submitted"; version: number; summary?: { present: number; absent: number; late: number; excused: number } };
type Status = "unmarked" | "present" | "absent" | "late" | "excused";
type RecordRow = { id: string; enrollmentId: string; studentName: string; studentClass?: string; status: Status; minutesLate?: number };

const statusOptions: Array<{ value: Exclude<Status, "unmarked">; label: string }> = [
  { value: "present", label: "উপস্থিত" }, { value: "absent", label: "অনুপস্থিত" }, { value: "late", label: "দেরি" }, { value: "excused", label: "ছুটি" },
];

export function TeacherAttendanceWorkspace() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeSession, setActiveSession] = useState<Session>();
  const [sheet, setSheet] = useState<Sheet>();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    void Promise.all([
      apiFetch<{ classSessions: Session[] }>(`/api/class-sessions?status=scheduled&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&limit=50`),
      apiFetch<{ assignments: Assignment[] }>("/api/teacher-assignments?status=active&limit=100"),
    ]).then(([sessionResult, assignmentResult]) => {
      if (sessionResult.ok && isApiSuccess(sessionResult.payload)) setSessions(sessionResult.payload.data.classSessions);
      if (assignmentResult.ok && isApiSuccess(assignmentResult.payload)) setAssignments(assignmentResult.payload.data.assignments);
      setLoading(false);
    });
  }, []);

  const identity = (session: Session) => assignments.find((item) => item.batchId === session.batchId && item.subjectId === session.subjectId);
  const counts = useMemo(() => ({
    present: records.filter((row) => row.status === "present").length,
    absent: records.filter((row) => row.status === "absent").length,
    late: records.filter((row) => row.status === "late").length,
    excused: records.filter((row) => row.status === "excused").length,
    unmarked: records.filter((row) => row.status === "unmarked").length,
  }), [records]);

  async function loadSheet(classSessionId: string) {
    const result = await apiFetch<{ sheet: Sheet | null; records: RecordRow[] }>(`/api/attendance?classSessionId=${classSessionId}`);
    if (result.ok && isApiSuccess(result.payload) && result.payload.data.sheet) { setSheet(result.payload.data.sheet); setRecords(result.payload.data.records); return true; }
    return false;
  }
  async function open(session: Session) {
    setActiveSession(session); setSaving(true); setMessage("");
    if (!(await loadSheet(session.id))) {
      const result = await apiFetch<{ sheet: Sheet }>("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "open", classSessionId: session.id, reason: "ক্লাসের attendance sheet খোলা" }) });
      if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "Attendance sheet খোলা যায়নি।")); setSaving(false); return; }
      await loadSheet(session.id);
    }
    setError(false); setSaving(false);
  }
  function mark(enrollmentId: string, status: Exclude<Status, "unmarked">) {
    setRecords((current) => current.map((row) => row.enrollmentId === enrollmentId ? { ...row, status, minutesLate: status === "late" ? (row.minutesLate || 1) : undefined } : row));
  }
  async function submit() {
    if (!sheet || counts.unmarked > 0 || sheet.status === "submitted") return;
    if (!window.confirm(`${records.length} জনের attendance submit করবেন? Submit-এর পর সরাসরি edit করা যাবে না।`)) return;
    setSaving(true); setMessage("");
    const marked = await apiFetch<{ sheet: Sheet }>("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark", sheetId: sheet.id, version: sheet.version, entries: records.map((row) => ({ enrollmentId: row.enrollmentId, status: row.status, minutesLate: row.status === "late" ? row.minutesLate || 1 : undefined })), reason: "শিক্ষক কর্তৃক attendance review" }) });
    if (!marked.ok || !isApiSuccess(marked.payload)) { setError(true); setMessage(getApiErrorMessage(marked.payload, "Attendance সংরক্ষণ করা যায়নি।")); setSaving(false); return; }
    const submitted = await apiFetch<{ sheet: Sheet }>("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ action: "submit", sheetId: sheet.id, version: marked.payload.data.sheet.version, reason: "ক্লাস attendance চূড়ান্ত submit" }) });
    if (!submitted.ok || !isApiSuccess(submitted.payload)) { setError(true); setMessage(getApiErrorMessage(submitted.payload, "Attendance submit করা যায়নি।")); }
    else { setSheet(submitted.payload.data.sheet); setError(false); setMessage("Attendance সফলভাবে submit হয়েছে।"); }
    setSaving(false);
  }

  return <section className="space-y-4" aria-labelledby="attendance-title"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Class attendance</p><h2 id="attendance-title" className="mt-1 text-xl font-black text-primary">আজকের attendance</h2></div>{message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}{!activeSession ? loading ? <div className="h-32 animate-pulse rounded-2xl bg-secondary" /> : sessions.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">আজকের জন্য কোনো scheduled class session নেই।</div> : <div className="grid gap-3 sm:grid-cols-2">{sessions.map((session) => { const item = identity(session); return <button type="button" key={session.id} onClick={() => void open(session)} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/50"><p className="font-black text-primary">{item?.subject?.nameBn || item?.subject?.name || "ক্লাস"}</p><p className="mt-1 text-sm text-muted">{item?.batch?.name} • {new Date(session.scheduledStart).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" })}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary"><UserCheck className="size-4" /> Attendance নিন</span></button>; })}</div> : <div className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4"><div><button type="button" onClick={() => { setActiveSession(undefined); setSheet(undefined); setRecords([]); }} className="text-xs font-bold text-muted">← আজকের ক্লাস</button><h3 className="mt-2 text-lg font-black text-primary">{identity(activeSession)?.subject?.nameBn || identity(activeSession)?.subject?.name}</h3><p className="text-sm text-muted">{identity(activeSession)?.batch?.name}</p></div>{sheet?.status === "submitted" ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700"><CheckCircle2 className="size-4" /> Submitted</span> : <Button type="button" variant="outline" size="sm" disabled={saving || !records.length} onClick={() => setRecords((current) => current.map((row) => ({ ...row, status: "present", minutesLate: undefined })))}><Check className="size-4" /> সবাই উপস্থিত</Button>}</div><div className="my-4 grid grid-cols-5 gap-2 text-center text-xs"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">উপস্থিত<br/><b>{counts.present}</b></span><span className="rounded-lg bg-red-50 p-2 text-red-700">অনুপস্থিত<br/><b>{counts.absent}</b></span><span className="rounded-lg bg-amber-50 p-2 text-amber-700">দেরি<br/><b>{counts.late}</b></span><span className="rounded-lg bg-sky-50 p-2 text-sky-700">ছুটি<br/><b>{counts.excused}</b></span><span className="rounded-lg bg-secondary p-2 text-muted">বাকি<br/><b>{counts.unmarked}</b></span></div><div className="space-y-2">{records.map((row) => <div key={row.enrollmentId} className="grid gap-3 rounded-xl border border-border p-3 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="font-bold text-primary">{row.studentName}</p><p className="text-xs text-muted">{row.studentClass}</p></div><div role="group" aria-label={`${row.studentName} attendance`} className="grid grid-cols-4 gap-1">{statusOptions.map((option) => <button type="button" key={option.value} disabled={sheet?.status === "submitted"} onClick={() => mark(row.enrollmentId, option.value)} className={cn("min-h-11 rounded-lg border px-2 text-xs font-bold", row.status === option.value ? "border-primary bg-primary text-white" : "border-border bg-white text-muted", option.value === "absent" && row.status === option.value && "border-red-600 bg-red-600")}>{option.label}</button>)}</div></div>)}</div>{sheet?.status === "draft" && <Button className="mt-5 w-full" size="lg" disabled={saving || counts.unmarked > 0} onClick={() => void submit()}>{saving ? "Submit হচ্ছে…" : counts.unmarked > 0 ? `${counts.unmarked} জনকে mark করুন` : "Review করে attendance submit করুন"}</Button>}</div>}</section>;
}
