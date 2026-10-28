"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Loader2, Pencil, UserCheck, X } from "lucide-react";

import { routineTime, type RoutineView } from "@/components/routine/RoutineDashboard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Session = RoutineView;
type Sheet = {
  id: string;
  classSessionId: string;
  status: "draft" | "submitted";
  version: number;
  summary?: { present: number; absent: number; late: number; excused: number };
};
type Status = "unmarked" | "present" | "absent" | "late" | "excused";
type RecordRow = {
  id: string;
  enrollmentId: string;
  studentName: string;
  studentCode?: string;
  studentClass?: string;
  status: Status;
  minutesLate?: number;
};

const statusOptions: Array<{
  value: Exclude<Status, "unmarked">;
  label: string;
  fullLabel: string;
}> = [
  { value: "present", label: "P", fullLabel: "উপস্থিত" },
  { value: "absent", label: "A", fullLabel: "অনুপস্থিত" },
];

function getDhakaWeekday(date = new Date()) {
  const dhaka = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  return dhaka.getUTCDay();
}

function safeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback below
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sameMark(left: RecordRow, right: RecordRow) {
  return left.status === right.status && left.minutesLate === right.minutesLate;
}

function sortRecordsById(rows: RecordRow[]): RecordRow[] {
  return [...rows].sort((a, b) => {
    const codeA = a.studentCode?.trim() || "";
    const codeB = b.studentCode?.trim() || "";
    if (codeA && codeB) {
      const cmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return cmp;
    } else if (codeA) {
      return -1;
    } else if (codeB) {
      return 1;
    }
    return (a.studentName || "").localeCompare(b.studentName || "");
  });
}

export function TeacherAttendanceWorkspace() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session>();
  const [sheet, setSheet] = useState<Sheet>();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [submittedRecords, setSubmittedRecords] = useState<RecordRow[]>([]);
  const [editingSubmitted, setEditingSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    void apiFetch<{ routines: RoutineView[] }>("/api/routines?status=active&limit=200").then((result) => {
      if (result.ok && isApiSuccess(result.payload)) {
        const today = getDhakaWeekday();
        setSessions(result.payload.data.routines.filter((routine) => routine.weekday === today));
      }
      setLoading(false);
    });
  }, []);

  const counts = useMemo(() => ({
    present: records.filter((row) => row.status === "present").length,
    absent: records.filter((row) => row.status === "absent").length,
    late: records.filter((row) => row.status === "late").length,
    excused: records.filter((row) => row.status === "excused").length,
    unmarked: records.filter((row) => row.status === "unmarked").length,
  }), [records]);

  const changedRecords = useMemo(() => {
    const originalByEnrollment = new Map(
      submittedRecords.map((record) => [record.enrollmentId, record]),
    );
    return records.filter((record) => {
      const original = originalByEnrollment.get(record.enrollmentId);
      return original ? !sameMark(record, original) : false;
    });
  }, [records, submittedRecords]);

  async function loadSheet(classSessionId: string) {
    const result = await apiFetch<{ sheet: Sheet | null; records: RecordRow[] }>(
      `/api/attendance?classSessionId=${classSessionId}`,
    );
    if (result.ok && isApiSuccess(result.payload) && result.payload.data.sheet) {
      const sorted = sortRecordsById(result.payload.data.records);
      setSheet(result.payload.data.sheet);
      setRecords(sorted);
      setSubmittedRecords(sorted.map((record) => ({ ...record })));
      setEditingSubmitted(false);
      return true;
    }
    return false;
  }

  async function open(session: Session) {
    setActiveSession(session);
    setSheetLoading(true);
    setRecords([]);
    setSubmittedRecords([]);
    setSheet(undefined);
    setEditingSubmitted(false);
    setMessage("");
    setError(false);

    try {
      const result = await apiFetch<{ sheet: Sheet; records?: RecordRow[] }>("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open-routine",
          routineSlotId: session.id,
          reason: "রুটিন অনুযায়ী attendance sheet খোলা",
        }),
      });
      if (!result.ok || !isApiSuccess(result.payload)) {
        setError(true);
        setMessage(getApiErrorMessage(result.payload, "Attendance sheet খোলা যায়নি।"));
        setActiveSession(undefined);
        return;
      }

      if (result.payload.data.sheet && Array.isArray(result.payload.data.records) && result.payload.data.records.length > 0) {
        const sorted = sortRecordsById(result.payload.data.records);
        setSheet(result.payload.data.sheet);
        setRecords(sorted);
        setSubmittedRecords(sorted.map((record) => ({ ...record })));
        setEditingSubmitted(false);
      } else {
        const loaded = await loadSheet(result.payload.data.sheet.classSessionId);
        if (!loaded) {
          setError(true);
          setMessage("Attendance sheet লোড করা যায়নি। অনুগ্রহ করে পেজ রিফ্রেশ করে পুনরায় চেষ্টা করুন।");
          setActiveSession(undefined);
        }
      }
    } finally {
      setSheetLoading(false);
    }
  }

  function mark(enrollmentId: string, status: Exclude<Status, "unmarked">) {
    setRecords((current) => current.map((row) => row.enrollmentId === enrollmentId
      ? { ...row, status, minutesLate: status === "late" ? (row.minutesLate || 1) : undefined }
      : row));
  }

  async function submit() {
    if (!sheet || counts.unmarked > 0 || sheet.status === "submitted") return;
    if (!window.confirm(`${records.length} জনের attendance submit করবেন? পরে প্রয়োজনে Edit attendance থেকে সংশোধন করা যাবে।`)) return;
    setSaving(true);
    setMessage("");

    const entries = records.map((row) => ({
      enrollmentId: row.enrollmentId,
      status: row.status,
      minutesLate: row.status === "late" ? row.minutesLate || 1 : undefined,
    }));

    const marked = await apiFetch<{ sheet: Sheet }>("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark",
        sheetId: sheet.id,
        version: sheet.version,
        entries,
        records: entries,
        reason: "ক্লাসের উপস্থিতি mark করা হয়েছে",
      }),
    });
    if (!marked.ok || !isApiSuccess(marked.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(marked.payload, "Attendance mark save করা যায়নি।"));
      setSaving(false);
      return;
    }

    const submitted = await apiFetch<{ sheet: Sheet; records?: RecordRow[] }>("/api/attendance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": safeIdempotencyKey(),
      },
      body: JSON.stringify({
        action: "submit",
        sheetId: sheet.id,
        version: marked.payload.data.sheet.version,
        reason: "ক্লাসের উপস্থিতি submit করা হয়েছে",
      }),
    });
    if (!submitted.ok || !isApiSuccess(submitted.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(submitted.payload, "Attendance submit করা যায়নি।"));
    } else {
      if (submitted.payload.data.records) {
        const sorted = sortRecordsById(submitted.payload.data.records);
        setSheet(submitted.payload.data.sheet);
        setRecords(sorted);
        setSubmittedRecords(sorted.map((record) => ({ ...record })));
        setEditingSubmitted(false);
      } else {
        await loadSheet(submitted.payload.data.sheet.classSessionId);
      }
      setError(false);
      setMessage("Attendance সফলভাবে submit হয়েছে।");
    }
    setSaving(false);
  }

  async function saveAmendment() {
    if (!sheet || changedRecords.length === 0) return;
    const rawReason = window.prompt("Attendance পরিবর্তনের কারণ লিখুন (অডিট রেকর্ডের জন্য প্রয়োজন):");
    if (!rawReason || !rawReason.trim()) return;
    const reason = rawReason.trim().length >= 4 ? rawReason.trim() : `${rawReason.trim()} সংশোধন`;

    setSaving(true);
    setMessage("");

    const entries = records.map((row) => ({
      enrollmentId: row.enrollmentId,
      status: row.status,
      minutesLate: row.status === "late" ? row.minutesLate || 1 : undefined,
    }));

    const result = await apiFetch<{ sheet: Sheet; changedCount: number; records?: RecordRow[] }>("/api/attendance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": safeIdempotencyKey(),
      },
      body: JSON.stringify({
        action: "amend",
        sheetId: sheet.id,
        version: sheet.version,
        entries,
        records: entries,
        reason,
      }),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "Attendance-এর পরিবর্তন Save করা যায়নি।"));
    } else {
      if (result.payload.data.records) {
        const sorted = sortRecordsById(result.payload.data.records);
        setSheet(result.payload.data.sheet);
        setRecords(sorted);
        setSubmittedRecords(sorted.map((record) => ({ ...record })));
        setEditingSubmitted(false);
      } else {
        await loadSheet(result.payload.data.sheet.classSessionId);
      }
      setError(false);
      setMessage(`${result.payload.data.changedCount} জনের attendance সংশোধন হয়েছে।`);
    }
    setSaving(false);
  }

  function closeSheet() {
    setActiveSession(undefined);
    setSheet(undefined);
    setRecords([]);
    setSubmittedRecords([]);
    setEditingSubmitted(false);
  }

  if (!activeSession) {
    return (
      <section className="space-y-4" aria-labelledby="attendance-title">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Class Attendance</p>
          <h2 id="attendance-title" className="mt-1 text-xl font-black text-primary">আজকের Attendance</h2>
        </div>

        {message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-secondary" />
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
            আজ আপনার কোনো Scheduled Class নেই।
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((session) => (
              <button
                type="button"
                key={session.id}
                onClick={() => void open(session)}
                className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/50"
              >
                <p className="font-black text-primary">{session.subject?.nameBn || session.subject?.name || session.subjectName || "ক্লাস"}</p>
                <p className="mt-1 text-sm text-muted">{session.batch?.name} • {routineTime(session.startMinute)}–{routineTime(session.endMinute)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  <UserCheck className="size-4" /> Attendance নিন
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  const controlsDisabled = saving || sheetLoading || (sheet?.status === "submitted" && !editingSubmitted);

  return (
    <section className="space-y-4" aria-labelledby="attendance-title">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Class Attendance</p>
        <h2 id="attendance-title" className="mt-1 text-xl font-black text-primary">আজকের Attendance</h2>
      </div>
      {message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <button type="button" onClick={closeSheet} className="text-xs font-bold text-muted">← আজকের ক্লাস</button>
            <h3 className="mt-2 text-lg font-black text-primary">{activeSession.subject?.nameBn || activeSession.subject?.name || activeSession.subjectName}</h3>
            <p className="text-sm text-muted">{activeSession.batch?.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sheet?.status === "submitted" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700"><CheckCircle2 className="size-4" /> Submitted</span>}
            {sheet?.status === "submitted" && !editingSubmitted && <Button type="button" variant="outline" size="sm" disabled={saving || sheetLoading} onClick={() => { setSubmittedRecords(records.map((record) => ({ ...record }))); setEditingSubmitted(true); setMessage(""); }}><Pencil className="size-4" /> Edit attendance</Button>}
            {editingSubmitted && <Button type="button" variant="outline" size="sm" disabled={saving || sheetLoading} onClick={() => { setRecords(submittedRecords.map((record) => ({ ...record }))); setEditingSubmitted(false); }}><X className="size-4" /> Cancel edit</Button>}
            {sheet?.status === "draft" && !sheetLoading && (
              <>
                <Button type="button" variant="outline" size="sm" disabled={saving || !records.length} onClick={() => setRecords((current) => current.map((row) => ({ ...row, status: "present", minutesLate: undefined })))}><Check className="size-4" /> সবাই P</Button>
                <Button type="button" variant="outline" size="sm" disabled={saving || !records.length} onClick={() => setRecords((current) => current.map((row) => ({ ...row, status: "absent", minutesLate: undefined })))}><X className="size-4" /> সবাই A</Button>
              </>
            )}
          </div>
        </div>
        <div className="my-4 grid grid-cols-3 gap-2 text-center text-xs">
          <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">P (উপস্থিত)<br /><b>{sheetLoading ? "—" : counts.present}</b></span>
          <span className="rounded-lg bg-red-50 p-2 text-red-700">A (অনুপস্থিত)<br /><b>{sheetLoading ? "—" : counts.absent}</b></span>
          <span className="rounded-lg bg-secondary p-2 text-muted">বাকি (Unmarked)<br /><b>{sheetLoading ? "—" : counts.unmarked}</b></span>
        </div>
        {sheetLoading ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary/50 p-4 text-xs font-bold text-muted">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>শিক্ষার্থীদের তালিকা লোড হচ্ছে…</span>
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
            এই ব্যাচে কোনো সক্রিয় শিক্ষার্থী পাওয়া যায়নি।
          </div>
        ) : (
          <div className="space-y-2">{records.map((row) => (
            <div key={row.enrollmentId} className="grid gap-3 rounded-xl border border-border p-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-center gap-3">
                <span className="flex h-9 min-w-16 shrink-0 items-center justify-center rounded-lg bg-secondary px-2 font-mono text-xs font-black text-primary">
                  {row.studentCode ? `ID ${row.studentCode}` : "ID নেই"}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-primary truncate">{row.studentName}</p>
                  <p className="text-xs text-muted truncate">{row.studentClass}</p>
                </div>
              </div>
              <div role="group" aria-label={`${row.studentName} attendance`} className="grid grid-cols-2 gap-1.5 w-32">{statusOptions.map((option) => (
                <button type="button" key={option.value} title={option.fullLabel} aria-label={`${row.studentName}: ${option.fullLabel}`} disabled={controlsDisabled} onClick={() => mark(row.enrollmentId, option.value)} className={cn("min-h-11 min-w-11 rounded-lg border px-3 text-sm font-black", row.status === option.value ? "border-primary bg-primary text-white" : "border-border bg-white text-muted", option.value === "absent" && row.status === option.value && "border-red-600 bg-red-600 text-white")}>{option.label}</button>
              ))}</div>
            </div>
          ))}</div>
        )}
        {sheet?.status === "draft" && !sheetLoading && <Button className="mt-5 w-full" size="lg" disabled={saving || counts.unmarked > 0 || records.length === 0} onClick={() => void submit()}>{saving ? "Submit হচ্ছে…" : counts.unmarked > 0 ? `${counts.unmarked} জনকে mark করুন` : "Review করে attendance submit করুন"}</Button>}
        {sheet?.status === "submitted" && editingSubmitted && !sheetLoading && <Button className="mt-5 w-full" size="lg" disabled={saving || changedRecords.length === 0} onClick={() => void saveAmendment()}>{saving ? "Save হচ্ছে…" : changedRecords.length === 0 ? "কোনো পরিবর্তন নেই" : `${changedRecords.length}টি পরিবর্তন Save করুন`}</Button>}
      </div>
    </section>
  );
}
