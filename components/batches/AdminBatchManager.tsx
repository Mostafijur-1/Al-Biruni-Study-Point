"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, CheckCircle2, Layers3, Pencil, Plus, Search, UserPlus, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type BatchStatus = "planned" | "active" | "closed" | "archived";
type Batch = {
  id: string;
  name: string;
  mode: "online" | "offline";
  defaultFeeTk: number;
  studentIdGroup: number;
  subjects: Array<{ id: string; name: string; nameBn: string; code: string }>;
  activeEnrollmentCount: number;
  status: BatchStatus;
};
type CatalogSubject = { code: string; name: string; nameBn: string };
type Student = { id: string; name: string; reference?: string; studentCode?: string; isActive: boolean };
type ActiveEnrollment = { student: { id: string } };
type StudentCodeContext = {
  prefix: string | null;
  lastStudentCode: string | null;
  nextStudentCode: string | null;
  yearRequired: boolean;
};

function isValidStudentCodeDraft(value: string, prefix: string | null) {
  if (!/^\d{7}$/.test(value)) return false;
  return !prefix || value.startsWith(prefix);
}

const statusLabel: Record<BatchStatus, string> = {
  planned: "পরিকল্পিত",
  active: "সক্রিয়",
  closed: "Closed",
  archived: "আর্কাইভ",
};

export function AdminBatchManager() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"online" | "offline">("offline");
  const [defaultFeeTk, setDefaultFeeTk] = useState(0);
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeEnrollments, setActiveEnrollments] = useState<ActiveEnrollment[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [editing, setEditing] = useState<Batch>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [addingToBatch, setAddingToBatch] = useState<Batch>();
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student>();
  const [assigningStudentId, setAssigningStudentId] = useState(false);
  const [studentCodeContext, setStudentCodeContext] = useState<StudentCodeContext>();
  const [studentCodeDraft, setStudentCodeDraft] = useState("");
  const [idFieldLocked, setIdFieldLocked] = useState(false);
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("father");

  const load = useCallback(async () => {
    setLoading(true);
    const [batchResult, studentResult, enrollmentResult] = await Promise.all([
      apiFetch<{ batches: Batch[]; context?: { subjects: CatalogSubject[] } }>("/api/batches?status=all&limit=100&includeContext=true"),
      apiFetch<{ users: Student[] }>("/api/admin/users?role=student"),
      apiFetch<{ enrollments: ActiveEnrollment[] }>("/api/enrollments?status=active&limit=200"),
    ]);
    if (batchResult.ok && isApiSuccess(batchResult.payload)) {
      setBatches(batchResult.payload.data.batches);
      setSubjects(batchResult.payload.data.context?.subjects ?? []);
    }
    if (studentResult.ok && isApiSuccess(studentResult.payload)) setStudents(studentResult.payload.data.users);
    if (enrollmentResult.ok && isApiSuccess(enrollmentResult.payload)) setActiveEnrollments(enrollmentResult.payload.data.enrollments);
    setLoading(false);
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  function startCreate() {
    setEditing(undefined);
    setName("");
    setMode("offline");
    setDefaultFeeTk(0);
    setSelectedSubjects([]);
    setOpen(true);
  }

  function startEdit(batch: Batch) {
    setEditing(batch);
    setName(batch.name);
    setMode(batch.mode);
    setDefaultFeeTk(batch.defaultFeeTk);
    setSelectedSubjects(batch.subjects.map((subject) => subject.name));
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(undefined);
    setName("");
    setMode("offline");
    setDefaultFeeTk(0);
    setSelectedSubjects([]);
  }

  const availableStudents = useMemo(() => {
    const enrolledStudentIds = new Set(activeEnrollments.map((enrollment) => enrollment.student.id));
    const term = studentQuery.trim().toLowerCase();
    return students
      .filter((student) => student.isActive && !enrolledStudentIds.has(student.id))
      .filter((student) => !term || `${student.name} ${student.studentCode ?? ""} ${student.reference ?? ""}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [activeEnrollments, studentQuery, students]);

  function openAddStudent(batch: Batch) {
    setAddingToBatch(batch);
    setStudentQuery("");
    setSelectedStudent(undefined);
    setStudentCodeDraft("");
    setIdFieldLocked(false);
    setStudentCodeContext(undefined);
    setMessage("");
    setGuardianPhone("");
    setGuardianRelation("father");
    void apiFetch<{ studentCodeContext: StudentCodeContext }>(
      `/api/enrollments?batchId=${batch.id}&studentCodeContext=true&status=active&limit=1`,
    ).then((result) => {
      if (!result.ok || !isApiSuccess(result.payload)) return;
      const context = result.payload.data.studentCodeContext;
      setStudentCodeContext(context);
      if (context.nextStudentCode) setStudentCodeDraft(context.nextStudentCode);
    });
  }

  function closeAddStudent() {
    setAddingToBatch(undefined);
    setStudentQuery("");
    setSelectedStudent(undefined);
    setAssigningStudentId(false);
    setStudentCodeContext(undefined);
    setStudentCodeDraft("");
    setIdFieldLocked(false);
    setGuardianPhone("");
    setGuardianRelation("father");
  }

  async function assignStudentCode(student: Student, requestedCode?: string) {
    if (!addingToBatch) return null;
    setAssigningStudentId(true);
    setMessage("");
    const result = await apiFetch<{ studentCode: string }>("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign-student-code",
        studentId: student.id,
        batchId: addingToBatch.id,
        ...(requestedCode ? { studentCode: requestedCode } : {}),
        reason: requestedCode
          ? "Admin manually assigned permanent Student ID before batch enrollment"
          : "Admin assigned permanent Student ID before batch enrollment",
      }),
    });
    setAssigningStudentId(false);
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "স্থায়ী Student ID দেওয়া যায়নি।"));
      return null;
    }
    const studentCode = result.payload.data.studentCode;
    setError(false);
    setSelectedStudent((current) => current?.id === student.id ? { ...current, studentCode } : current);
    setStudents((current) => current.map((item) => item.id === student.id ? { ...item, studentCode } : item));
    setStudentCodeDraft(studentCode);
    setIdFieldLocked(true);
    void apiFetch<{ studentCodeContext: StudentCodeContext }>(
      `/api/enrollments?batchId=${addingToBatch.id}&studentCodeContext=true&status=active&limit=1`,
    ).then((contextResult) => {
      if (contextResult.ok && isApiSuccess(contextResult.payload)) {
        setStudentCodeContext(contextResult.payload.data.studentCodeContext);
      }
    });
    return studentCode;
  }

  async function selectStudentForBatch(student: Student) {
    if (!addingToBatch) return;
    setSelectedStudent(student);
    setMessage("");
    if (student.studentCode) {
      setStudentCodeDraft(student.studentCode);
      setIdFieldLocked(true);
      return;
    }
    setIdFieldLocked(false);
    setStudentCodeDraft(studentCodeContext?.nextStudentCode ?? "");
  }

  async function applyManualStudentCode() {
    if (!selectedStudent || selectedStudent.studentCode || !studentCodeDraft.trim()) return;
    if (!isValidStudentCodeDraft(studentCodeDraft.trim(), studentCodeContext?.prefix ?? null)) {
      setError(true);
      setMessage(studentCodeContext?.prefix
        ? `Student ID ৭ সংখ্যার হতে হবে এবং ${studentCodeContext.prefix} দিয়ে শুরু করতে হবে।`
        : "Student ID অবশ্যই ৭ সংখ্যার হতে হবে।");
      return;
    }
    await assignStudentCode(selectedStudent, studentCodeDraft.trim());
  }

  async function addStudentToBatch(event: FormEvent) {
    event.preventDefault();
    if (!addingToBatch || !selectedStudent) return;
    setSaving(true);
    setMessage("");
    const studentCode = selectedStudent.studentCode;
    const draft = studentCodeDraft.trim();
    if (!studentCode) {
      if (!isValidStudentCodeDraft(draft, studentCodeContext?.prefix ?? null)) {
        setError(true);
        setMessage(studentCodeContext?.prefix
          ? `${studentCodeContext.prefix} দিয়ে শুরু হওয়া সঠিক ৭ সংখ্যার Student ID দিন।`
          : "Enrollment-এর আগে সঠিক ৭ সংখ্যার Student ID দিন।");
        setSaving(false);
        return;
      }
    }
    const result = await apiFetch<{ studentCode?: string }>("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enroll",
        studentId: selectedStudent.id,
        batchId: addingToBatch.id,
        subjectIds: addingToBatch.subjects.map((subject) => subject.id),
        feeTk: addingToBatch.defaultFeeTk,
        guardianPhone: guardianPhone.trim() ? guardianPhone.trim() : undefined,
        guardianRelation: guardianPhone.trim() ? guardianRelation : undefined,
        ...(studentCode ? {} : { studentCode: draft }),
        reason: "Admin added student from Batch management",
      }),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "শিক্ষার্থীকে এই Batch-এ যোগ করা যায়নি।"));
    } else {
      setError(false);
      const assignedCode = result.payload.data.studentCode ?? studentCode;
      setMessage(`${selectedStudent.name}-কে যোগ করা হয়েছে। স্থায়ী Student ID: ${assignedCode ?? "দেওয়া হয়েছে"}।`);
      closeAddStudent();
      await load();
    }
    setSaving(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const body = editing
      ? {
        batchId: editing.id,
        name,
        mode,
        defaultFeeTk,
        subjectNames: selectedSubjects,
        reason: "Admin Batch-এর নাম ও বিষয় Update করেছেন",
      }
      : {
        name,
        mode,
        defaultFeeTk,
        subjectNames: selectedSubjects,
      };

    const result = await apiFetch("/api/batches", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "Batch Save করা যায়নি।"));
    } else {
      setError(false);
      setMessage(
        editing
          ? "Batch-এর নাম ও বিষয় Update হয়েছে।"
          : "নতুন Batch ও এর বিষয়সমূহ তৈরি হয়েছে।",
      );
      closeForm();
      await load();
    }
    setSaving(false);
  }

  async function changeStatus(batch: Batch, status: BatchStatus) {
    const action = status === "active" ? "Activate" : status === "closed" ? "Close" : "Archive";
    if (!window.confirm(`${batch.name} ব্যাচটি ${action} করবেন?`)) return;
    setSaving(true);
    setMessage("");
    const result = await apiFetch("/api/batches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: batch.id,
        status,
        reason: `অ্যাডমিন কর্তৃক ব্যাচ ${action}`,
      }),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "ব্যাচের অবস্থা পরিবর্তন করা যায়নি।"));
    } else {
      setError(false);
      setMessage(`ব্যাচটি ${action} হয়েছে।`);
      await load();
    }
    setSaving(false);
  }

  return (
    <section className="space-y-5" aria-labelledby="batch-management-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-accent-foreground">
            Batch Management
          </p>
          <h2 id="batch-management-title" className="mt-1 text-2xl font-black text-primary">
            Batch তৈরি ও Management
          </h2>
        </div>
        <Button onClick={startCreate}>
          <Plus className="size-4" /> New Batch
        </Button>
      </div>

      {message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}

      {open && (
        <form
          onSubmit={save}
          className="mx-auto max-w-xl rounded-3xl border border-primary/30 bg-card p-5 shadow-[var(--shadow-md)]"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-black text-primary">
              {editing ? "Batch Edit" : "নতুন Batch"}
            </h3>
            <button type="button" aria-label="ফর্ম Close করুন" onClick={closeForm}>
              <X className="size-5 text-muted" />
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-name">Batch-এর নাম</Label>
            <Input
              id="batch-name"
              required
              minLength={2}
              maxLength={120}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="যেমন: HSC 2029"
            />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="batch-mode">Batch-এর ধরন</Label><select id="batch-mode" value={mode} onChange={(event) => setMode(event.target.value as "online" | "offline")} className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"><option value="offline">Offline</option><option value="online">Online</option></select></div>
            <div className="space-y-2"><Label htmlFor="batch-default-fee">Default মাসিক Fee (৳)</Label><Input id="batch-default-fee" type="number" min={0} max={10000000} required value={defaultFeeTk} onChange={(event) => setDefaultFeeTk(Number(event.target.value))} /></div>
          </div>
          <fieldset className="mt-5"><legend className="text-sm font-bold text-primary">Batch-এর বিষয়সমূহ</legend><p className="mt-1 text-xs text-muted">ভর্তির সময় এগুলো শুরুতে নির্বাচিত থাকবে; শিক্ষার্থী অনুযায়ী বিষয় ও ফি পরিবর্তন করা যাবে।</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{subjects.map((subject) => { const checked = selectedSubjects.includes(subject.name); return <button key={subject.code} type="button" aria-pressed={checked} onClick={() => setSelectedSubjects((current) => checked ? current.filter((name) => name !== subject.name) : [...current, subject.name])} className={cn("flex items-center gap-2 rounded-xl border p-3 text-left", checked ? "border-primary bg-secondary" : "border-border")}><span className={cn("grid size-5 place-items-center rounded border", checked ? "border-primary bg-primary text-white" : "border-border")}>{checked && <Check className="size-3.5" />}</span><span className="text-sm font-bold text-primary">{subject.nameBn || subject.name}</span></button>; })}</div></fieldset>
          <Button className="mt-5 w-full" type="submit" disabled={saving || selectedSubjects.length === 0}>
            {saving ? "Save হচ্ছে…" : editing ? "Batch Update করুন" : "Batch তৈরি করুন"}
          </Button>
        </form>
      )}

      {addingToBatch && (
        <form onSubmit={addStudentToBatch} className="mx-auto max-w-xl rounded-3xl border border-primary/30 bg-card p-5 shadow-[var(--shadow-md)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">শিক্ষার্থী যোগ করুন</p><h3 className="mt-1 text-xl font-black text-primary">{addingToBatch.name}</h3></div>
            <button type="button" aria-label="শিক্ষার্থী যোগ করার ফর্ম Close করুন" onClick={closeAddStudent}><X className="size-5 text-muted" /></button>
          </div>
          <p className="mb-4 text-sm text-muted">Student ID, নাম বা reference দিয়ে Search করুন। সর্বশেষ ID অনুযায়ী পরের ID স্বয়ংক্রিয়ভাবে দেওয়া হবে; চাইলে একই ঘরে অন্য ৭ সংখ্যার ID লিখতে পারবেন।</p>
          {studentCodeContext && (
            <div className="mb-4 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-primary">
              {studentCodeContext.yearRequired ? (
                <p className="font-bold text-amber-800">Student ID দেওয়ার আগে Batch-এর নামে ৪ সংখ্যার বছর থাকতে হবে (যেমন: HSC 2028)।</p>
              ) : (
                <p>
                  {studentCodeContext.lastStudentCode
                    ? <>সর্বশেষ দেওয়া ID: <span className="font-mono font-black">{studentCodeContext.lastStudentCode}</span></>
                    : "এই Batch prefix-এ এখনো কোনো Student ID দেওয়া হয়নি।"}
                  {studentCodeContext.nextStudentCode && (
                    <> · পরামর্শকৃত পরের ID: <span className="font-mono font-black">{studentCodeContext.nextStudentCode}</span></>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted" /><Input autoFocus value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} className="pl-9" placeholder="Student ID, নাম বা reference দিয়ে Search করুন" /></div>
          <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
            {availableStudents.map((student) => <button key={student.id} type="button" disabled={assigningStudentId} onClick={() => selectStudentForBatch(student)} className={cn("flex w-full items-center justify-between rounded-xl border p-3 text-left", selectedStudent?.id === student.id ? "border-primary bg-secondary" : "border-border hover:border-primary/40")}><span><b className="text-sm text-primary">{student.name}</b>{student.studentCode && <small className="ml-2 font-mono text-muted">ID {student.studentCode}</small>}{student.reference && <small className="ml-2 text-muted">#{student.reference}</small>}</span>{selectedStudent?.id === student.id && <Check className="size-4 text-primary" />}</button>)}
            {studentQuery && availableStudents.length === 0 && <p className="rounded-xl bg-secondary p-3 text-sm text-muted">উপযুক্ত কোনো শিক্ষার্থী পাওয়া যায়নি।</p>}
          </div>
          {selectedStudent && <div className="mt-4 space-y-3 rounded-xl bg-secondary p-3 text-sm text-primary"><p><b>{selectedStudent.name}</b>-কে {addingToBatch.subjects.length}টি Default বিষয় এবং মাসে {addingToBatch.defaultFeeTk.toLocaleString("en-US")} ৳ Default Fee দেওয়া হবে।</p><div className="space-y-1.5"><Label htmlFor="assigned-student-id">স্থায়ী Student ID</Label><Input id="assigned-student-id" readOnly={idFieldLocked || assigningStudentId} value={studentCodeDraft} onChange={(event) => setStudentCodeDraft(event.target.value.replace(/\D/g, "").slice(0, 7))} placeholder={assigningStudentId ? "ID দেওয়া হচ্ছে…" : studentCodeContext?.nextStudentCode ?? "৭ সংখ্যার ID লিখুন"} className="font-mono font-black" inputMode="numeric" pattern="\d{7}" maxLength={7} /><p className="text-xs text-muted">{idFieldLocked ? "এই স্থায়ী ID শিক্ষার্থীর Profile-এ Save হয় এবং Attendance, Finance ও Result-এ ব্যবহৃত হয়।" : studentCodeContext?.lastStudentCode ? `সর্বশেষ ID ছিল ${studentCodeContext.lastStudentCode}। প্রস্তাবিত ID রাখুন অথবা ${studentCodeContext.prefix ?? ""} দিয়ে শুরু হওয়া অন্য ৭ সংখ্যার ID লিখুন।` : "৭ সংখ্যার Student ID লিখুন অথবা প্রস্তাবিত পরের ID রাখুন।"}</p></div>{!idFieldLocked && selectedStudent && !assigningStudentId && <Button type="button" variant="outline" className="w-full" onClick={() => void applyManualStudentCode()} disabled={!isValidStudentCodeDraft(studentCodeDraft.trim(), studentCodeContext?.prefix ?? null)}>ID Apply করুন</Button>}<div className="grid gap-3 sm:grid-cols-[1fr_150px]"><div className="space-y-1.5"><Label htmlFor="batch-guardian-phone">Guardian-এর ফোন (Optional)</Label><Input id="batch-guardian-phone" inputMode="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value.replace(/[^+0-9]/g, "").slice(0, 16))} placeholder="016339****2 (Optional)" /></div><div className="space-y-1.5"><Label htmlFor="batch-guardian-relation">সম্পর্ক</Label><select id="batch-guardian-relation" value={guardianRelation} onChange={(event) => setGuardianRelation(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-white px-3"><option value="father">বাবা</option><option value="mother">মা</option><option value="brother">ভাই</option><option value="sister">বোন</option><option value="uncle">চাচা/মামা</option><option value="aunt">চাচি/মামি</option><option value="other">অন্যান্য</option></select></div></div></div>}
          <Button className="mt-5 w-full" type="submit" disabled={saving || assigningStudentId || !selectedStudent || (Boolean(guardianPhone.trim()) && !/^\+?[0-9]{10,15}$/.test(guardianPhone.trim())) || (!selectedStudent.studentCode && !isValidStudentCodeDraft(studentCodeDraft.trim(), studentCodeContext?.prefix ?? null))}>{saving ? "যোগ করা হচ্ছে…" : assigningStudentId ? "Student ID দেওয়া হচ্ছে…" : "শিক্ষার্থী যোগ করুন"}</Button>
        </form>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-secondary" />
      ) : batches.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-muted">
          কোনো ব্যাচ নেই।
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {batches.map((batch) => (
            <article key={batch.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Layers3 className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-black text-primary">{batch.name}</h3>
                    <p className="text-xs text-muted">{batch.activeEnrollmentCount} শিক্ষার্থী · {batch.mode === "online" ? "Online" : "Offline"} · {batch.defaultFeeTk.toLocaleString("en-US")} ৳/মাস</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-black",
                    batch.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : batch.status === "planned"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-secondary text-muted",
                  )}
                >
                  {statusLabel[batch.status]}
                </span>
              </div>
              {batch.subjects.length > 0 && <p className="mt-3 text-xs text-muted">Default বিষয়: {batch.subjects.map((subject) => subject.nameBn || subject.name).join(" • ")}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {(batch.status === "planned" || batch.status === "active") && (
                  <Button size="sm" variant="outline" onClick={() => startEdit(batch)}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                )}
                {(batch.status === "planned" || batch.status === "active") && (
                  <Button size="sm" variant="outline" onClick={() => openAddStudent(batch)}>
                    <UserPlus className="size-4" /> শিক্ষার্থী যোগ করুন
                  </Button>
                )}
                {batch.status === "planned" && (
                  <Button size="sm" onClick={() => void changeStatus(batch, "active")} disabled={saving}>
                    <CheckCircle2 className="size-4" /> Activate
                  </Button>
                )}
                {batch.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => void changeStatus(batch, "closed")} disabled={saving}>
                    Close
                  </Button>
                )}
                {(batch.status === "planned" || batch.status === "closed") && (
                  <Button size="sm" variant="outline" onClick={() => void changeStatus(batch, "archived")} disabled={saving}>
                    <Archive className="size-4" /> Archive
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
