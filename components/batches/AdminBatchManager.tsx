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
  closed: "বন্ধ",
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
      setMessage(getApiErrorMessage(result.payload, "Permanent Student ID could not be assigned."));
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
        ? `Student ID must be 7 digits and start with ${studentCodeContext.prefix}.`
        : "Student ID must be a 7-digit number.");
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
          ? `Assign a valid 7-digit Student ID starting with ${studentCodeContext.prefix}.`
          : "Assign a valid 7-digit Student ID before enrollment.");
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
        guardianPhone: guardianPhone.trim(),
        guardianRelation,
        ...(studentCode ? {} : { studentCode: draft }),
        reason: "Admin added student from Batch management",
      }),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "Student could not be added to this batch."));
    } else {
      setError(false);
      const assignedCode = result.payload.data.studentCode ?? studentCode;
      setMessage(`${selectedStudent.name} was added. Permanent Student ID: ${assignedCode ?? "assigned"}.`);
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
        reason: "অ্যাডমিন কর্তৃক Batch-এর নাম ও বিষয় হালনাগাদ",
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
      setMessage(getApiErrorMessage(result.payload, "ব্যাচ সংরক্ষণ করা যায়নি।"));
    } else {
      setError(false);
      setMessage(
        editing
          ? "Batch-এর নাম ও বিষয়সমূহ হালনাগাদ হয়েছে।"
          : "নতুন Batch ও এর বিষয়সমূহ তৈরি হয়েছে।",
      );
      closeForm();
      await load();
    }
    setSaving(false);
  }

  async function changeStatus(batch: Batch, status: BatchStatus) {
    const action = status === "active" ? "সক্রিয়" : status === "closed" ? "বন্ধ" : "আর্কাইভ";
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
            Batch management
          </p>
          <h2 id="batch-management-title" className="mt-1 text-2xl font-black text-primary">
            Batch তৈরি ও ব্যবস্থাপনা
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
              {editing ? "Batch সম্পাদনা" : "নতুন Batch"}
            </h3>
            <button type="button" aria-label="ফর্ম বন্ধ করুন" onClick={closeForm}>
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
            <div className="space-y-2"><Label htmlFor="batch-mode">Batch type</Label><select id="batch-mode" value={mode} onChange={(event) => setMode(event.target.value as "online" | "offline")} className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"><option value="offline">Offline</option><option value="online">Online</option></select></div>
            <div className="space-y-2"><Label htmlFor="batch-default-fee">Default monthly fee (৳)</Label><Input id="batch-default-fee" type="number" min={0} max={10000000} required value={defaultFeeTk} onChange={(event) => setDefaultFeeTk(Number(event.target.value))} /></div>
          </div>
          <fieldset className="mt-5"><legend className="text-sm font-bold text-primary">Batch-এর বিষয়সমূহ</legend><p className="mt-1 text-xs text-muted">ভর্তির সময় এগুলো শুরুতে নির্বাচিত থাকবে; শিক্ষার্থী অনুযায়ী বিষয় ও ফি পরিবর্তন করা যাবে।</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{subjects.map((subject) => { const checked = selectedSubjects.includes(subject.name); return <button key={subject.code} type="button" aria-pressed={checked} onClick={() => setSelectedSubjects((current) => checked ? current.filter((name) => name !== subject.name) : [...current, subject.name])} className={cn("flex items-center gap-2 rounded-xl border p-3 text-left", checked ? "border-primary bg-secondary" : "border-border")}><span className={cn("grid size-5 place-items-center rounded border", checked ? "border-primary bg-primary text-white" : "border-border")}>{checked && <Check className="size-3.5" />}</span><span className="text-sm font-bold text-primary">{subject.nameBn || subject.name}</span></button>; })}</div></fieldset>
          <Button className="mt-5 w-full" type="submit" disabled={saving || selectedSubjects.length === 0}>
            {saving ? "Saving…" : editing ? "Update Batch" : "Create Batch"}
          </Button>
        </form>
      )}

      {addingToBatch && (
        <form onSubmit={addStudentToBatch} className="mx-auto max-w-xl rounded-3xl border border-primary/30 bg-card p-5 shadow-[var(--shadow-md)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Add student</p><h3 className="mt-1 text-xl font-black text-primary">{addingToBatch.name}</h3></div>
            <button type="button" aria-label="Close add student form" onClick={closeAddStudent}><X className="size-5 text-muted" /></button>
          </div>
          <p className="mb-4 text-sm text-muted">Search by Student ID, name, or reference. The next ID is filled automatically from the last assigned ID; you can type a different 7-digit ID in the same field.</p>
          {studentCodeContext && (
            <div className="mb-4 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-primary">
              {studentCodeContext.yearRequired ? (
                <p className="font-bold text-amber-800">This batch name must include a four-digit year (e.g. HSC 2028) before Student IDs can be assigned.</p>
              ) : (
                <p>
                  {studentCodeContext.lastStudentCode
                    ? <>Last assigned ID: <span className="font-mono font-black">{studentCodeContext.lastStudentCode}</span></>
                    : "No Student ID has been assigned for this batch prefix yet."}
                  {studentCodeContext.nextStudentCode && (
                    <> · Next suggested: <span className="font-mono font-black">{studentCodeContext.nextStudentCode}</span></>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted" /><Input autoFocus value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} className="pl-9" placeholder="Search by Student ID, name, or reference" /></div>
          <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
            {availableStudents.map((student) => <button key={student.id} type="button" disabled={assigningStudentId} onClick={() => selectStudentForBatch(student)} className={cn("flex w-full items-center justify-between rounded-xl border p-3 text-left", selectedStudent?.id === student.id ? "border-primary bg-secondary" : "border-border hover:border-primary/40")}><span><b className="text-sm text-primary">{student.name}</b>{student.studentCode && <small className="ml-2 font-mono text-muted">ID {student.studentCode}</small>}{student.reference && <small className="ml-2 text-muted">#{student.reference}</small>}</span>{selectedStudent?.id === student.id && <Check className="size-4 text-primary" />}</button>)}
            {studentQuery && availableStudents.length === 0 && <p className="rounded-xl bg-secondary p-3 text-sm text-muted">No available student found.</p>}
          </div>
          {selectedStudent && <div className="mt-4 space-y-3 rounded-xl bg-secondary p-3 text-sm text-primary"><p><b>{selectedStudent.name}</b> will receive {addingToBatch.subjects.length} default subject{addingToBatch.subjects.length === 1 ? "" : "s"} and a {addingToBatch.defaultFeeTk.toLocaleString("en-US")} ৳ default monthly fee.</p><div className="space-y-1.5"><Label htmlFor="assigned-student-id">Permanent Student ID</Label><Input id="assigned-student-id" readOnly={idFieldLocked || assigningStudentId} value={studentCodeDraft} onChange={(event) => setStudentCodeDraft(event.target.value.replace(/\D/g, "").slice(0, 7))} placeholder={assigningStudentId ? "Assigning…" : studentCodeContext?.nextStudentCode ?? "Enter 7-digit ID"} className="font-mono font-black" inputMode="numeric" pattern="\d{7}" maxLength={7} /><p className="text-xs text-muted">{idFieldLocked ? "This permanent ID is saved on the student profile and used across attendance, finance, and results." : studentCodeContext?.lastStudentCode ? `Last ID was ${studentCodeContext.lastStudentCode}. Keep the suggested ID or type another 7-digit ID starting with ${studentCodeContext.prefix ?? ""}.` : "Type a 7-digit Student ID, or keep the suggested next ID."}</p></div>{!idFieldLocked && selectedStudent && !assigningStudentId && <Button type="button" variant="outline" className="w-full" onClick={() => void applyManualStudentCode()} disabled={!isValidStudentCodeDraft(studentCodeDraft.trim(), studentCodeContext?.prefix ?? null)}>Apply ID</Button>}<div className="grid gap-3 sm:grid-cols-[1fr_150px]"><div className="space-y-1.5"><Label htmlFor="batch-guardian-phone">Guardian phone</Label><Input id="batch-guardian-phone" required inputMode="tel" pattern="\+?[0-9]{10,15}" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value.replace(/[^+0-9]/g, "").slice(0, 16))} placeholder="01XXXXXXXXX" /></div><div className="space-y-1.5"><Label htmlFor="batch-guardian-relation">Relation</Label><select id="batch-guardian-relation" required value={guardianRelation} onChange={(event) => setGuardianRelation(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-white px-3"><option value="father">Father</option><option value="mother">Mother</option><option value="brother">Brother</option><option value="sister">Sister</option><option value="uncle">Uncle</option><option value="aunt">Aunt</option><option value="other">Other</option></select></div></div></div>}
          <Button className="mt-5 w-full" type="submit" disabled={saving || assigningStudentId || !selectedStudent || !/^\+?[0-9]{10,15}$/.test(guardianPhone.trim()) || (!selectedStudent.studentCode && !isValidStudentCodeDraft(studentCodeDraft.trim(), studentCodeContext?.prefix ?? null))}>{saving ? "Adding…" : assigningStudentId ? "Assigning Student ID…" : "Add Student"}</Button>
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
              {batch.subjects.length > 0 && <p className="mt-3 text-xs text-muted">Default subjects: {batch.subjects.map((subject) => subject.nameBn || subject.name).join(" • ")}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {(batch.status === "planned" || batch.status === "active") && (
                  <Button size="sm" variant="outline" onClick={() => startEdit(batch)}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                )}
                {(batch.status === "planned" || batch.status === "active") && (
                  <Button size="sm" variant="outline" onClick={() => openAddStudent(batch)}>
                    <UserPlus className="size-4" /> Add Student
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
