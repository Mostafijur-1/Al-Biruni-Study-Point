"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Search, UserPlus, UsersRound, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Student = { id: string; name: string; reference?: string; studentCode?: string; studentClass?: string; isActive: boolean };
type Batch = { id: string; name: string; code: string; studentClass: string; status: string; defaultFeeTk: number };
type Subject = { id: string; name: string; nameBn: string };
type Enrollment = {
  id: string; batchId: string; student: Student; batch?: { name: string; code: string };
  subjects: Subject[]; feeTk: number; status: string; guardianPhone: string; guardianRelation: string;
};
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

const selectClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

export function CoachingEnrollmentPanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [query, setQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student>();
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment>();
  const [batchId, setBatchId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [feeTk, setFeeTk] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [assigningStudentId, setAssigningStudentId] = useState(false);
  const [studentCodeContext, setStudentCodeContext] = useState<StudentCodeContext>();
  const [studentCodeDraft, setStudentCodeDraft] = useState("");
  const [idFieldLocked, setIdFieldLocked] = useState(false);
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("father");

  const load = useCallback(async () => {
    setLoading(true);
    const [studentResult, activeBatchResult, plannedBatchResult, enrollmentResult] = await Promise.all([
      apiFetch<{ users: Student[] }>("/api/admin/users?role=student"),
      apiFetch<{ batches: Batch[] }>("/api/batches?status=active&limit=100"),
      apiFetch<{ batches: Batch[] }>("/api/batches?status=planned&limit=100"),
      apiFetch<{ enrollments: Enrollment[] }>("/api/enrollments?status=active&limit=200"),
    ]);
    if (studentResult.ok && isApiSuccess(studentResult.payload)) setStudents(studentResult.payload.data.users);
    const nextBatches = [activeBatchResult, plannedBatchResult].flatMap((result) => result.ok && isApiSuccess(result.payload) ? result.payload.data.batches : []);
    setBatches([...new Map(nextBatches.map((batch) => [batch.id, batch])).values()]);
    if (enrollmentResult.ok && isApiSuccess(enrollmentResult.payload)) setEnrollments(enrollmentResult.payload.data.enrollments);
    setLoading(false);
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  useEffect(() => {
    if (!batchId) return;
    void apiFetch<{ subjects: Subject[] }>(`/api/coaching-subjects?batchId=${batchId}`).then((result) => {
      if (!result.ok || !isApiSuccess(result.payload)) { setSubjects([]); setSubjectIds([]); return; }
      const configured = result.payload.data.subjects;
      setSubjects(configured);
      setSubjectIds(selectedEnrollment?.batchId === batchId ? selectedEnrollment.subjects.map((subject) => subject.id) : configured.map((subject) => subject.id));
    });
  }, [batchId, selectedEnrollment]);

  useEffect(() => {
    if (!batchId) {
      return;
    }
    let cancelled = false;
    void apiFetch<{ studentCodeContext: StudentCodeContext }>(
      `/api/enrollments?batchId=${batchId}&studentCodeContext=true&status=active&limit=1`,
    ).then((result) => {
      if (cancelled || !result.ok || !isApiSuccess(result.payload)) return;
      const context = result.payload.data.studentCodeContext;
      setStudentCodeContext(context);
      if (!selectedStudent?.studentCode && !selectedEnrollment && context.nextStudentCode) {
        setStudentCodeDraft(context.nextStudentCode);
        setIdFieldLocked(false);
      }
    });
    return () => { cancelled = true; };
  }, [batchId, selectedEnrollment, selectedStudent?.studentCode]);

  async function assignStudentCode(requestedCode?: string) {
    if (!selectedStudent || !batchId || selectedStudent.studentCode || selectedEnrollment) return null;
    setAssigningStudentId(true);
    const result = await apiFetch<{ studentCode: string }>("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign-student-code",
        studentId: selectedStudent.id,
        batchId,
        ...(requestedCode ? { studentCode: requestedCode } : {}),
        reason: requestedCode
          ? "Admin manually assigned permanent Student ID before coaching enrollment"
          : "Admin assigned permanent Student ID before coaching enrollment",
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
    setSelectedStudent((current) => current?.id === selectedStudent.id ? { ...current, studentCode } : current);
    setStudents((current) => current.map((student) => student.id === selectedStudent.id ? { ...student, studentCode } : student));
    setStudentCodeDraft(studentCode);
    setIdFieldLocked(true);
    return studentCode;
  }

  function prepareStudentCodeForEnrollment(student: Student, nextContext?: StudentCodeContext) {
    if (student.studentCode) {
      setStudentCodeDraft(student.studentCode);
      setIdFieldLocked(true);
      return;
    }
    setIdFieldLocked(false);
    setStudentCodeDraft(nextContext?.nextStudentCode ?? "");
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
    await assignStudentCode(studentCodeDraft.trim());
  }

  const visibleEnrollments = useMemo(() => enrollments.filter((item) => {
    const text = `${item.student.name} ${item.student.studentCode || ""} ${item.student.reference || ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!batchFilter || item.batchId === batchFilter);
  }), [enrollments, query, batchFilter]);
  const candidates = useMemo(() => students.filter((student) => {
    if (!query || enrollments.some((item) => item.student.id === student.id)) return false;
    return `${student.name} ${student.studentCode || ""} ${student.reference || ""}`.toLowerCase().includes(query.toLowerCase());
  }).slice(0, 8), [students, query, enrollments]);
  function chooseEnrollment(enrollment: Enrollment) {
    setSelectedEnrollment(enrollment); setSelectedStudent(enrollment.student); setBatchId(enrollment.batchId);
    setStudentCodeDraft(enrollment.student.studentCode ?? "");
    setIdFieldLocked(Boolean(enrollment.student.studentCode));
    setFeeTk(enrollment.feeTk);
    setGuardianPhone(enrollment.guardianPhone ?? "");
    setGuardianRelation(enrollment.guardianRelation ?? "father");
    setMessage("");
  }
  function chooseStudent(student: Student) {
    const batchFromLink = new URLSearchParams(window.location.search).get("batchId") || "";
    setSelectedEnrollment(undefined); setSelectedStudent(student); setBatchId(batchFromLink); setBatchFilter(batchFromLink); setSubjects([]); setSubjectIds([]); setFeeTk(batches.find((batch) => batch.id === batchFromLink)?.defaultFeeTk ?? 0);
    prepareStudentCodeForEnrollment(student, studentCodeContext);
    setGuardianPhone("");
    setGuardianRelation("father");
    setMessage("");
  }
  function closeEditor() { setSelectedStudent(undefined); setSelectedEnrollment(undefined); setBatchId(""); setSubjects([]); setSubjectIds([]); setFeeTk(0); setStudentCodeDraft(""); setIdFieldLocked(false); setStudentCodeContext(undefined); setGuardianPhone(""); setGuardianRelation("father"); }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selectedStudent || !batchId || !subjectIds.length) return;
    setSaving(true); setMessage("");
    if (!selectedEnrollment && !selectedStudent.studentCode) {
      const draft = studentCodeDraft.trim();
      if (!isValidStudentCodeDraft(draft, studentCodeContext?.prefix ?? null)) {
        setError(true);
        setMessage(studentCodeContext?.prefix
          ? `Assign a valid 7-digit Student ID starting with ${studentCodeContext.prefix}.`
          : "Assign a valid 7-digit Student ID before enrollment.");
        setSaving(false);
        return;
      }
      const assigned = await assignStudentCode(draft);
      if (!assigned) {
        setSaving(false);
        return;
      }
    }
    const body = selectedEnrollment
      ? batchId !== selectedEnrollment.batchId
        ? { action: "transfer", enrollmentId: selectedEnrollment.id, targetBatchId: batchId, subjectIds, feeTk, guardianPhone, guardianRelation, reason: "অ্যাডমিন কর্তৃক coaching batch transfer" }
        : { action: "update-subjects", enrollmentId: selectedEnrollment.id, subjectIds, feeTk, guardianPhone, guardianRelation, reason: "অ্যাডমিন কর্তৃক কোচিং বিষয় ও ফি হালনাগাদ" }
      : { action: "enroll", studentId: selectedStudent.id, batchId, subjectIds, feeTk, guardianPhone, guardianRelation, reason: "অ্যাডমিন কর্তৃক কোচিং ব্যাচে ভর্তি" };
    const result = await apiFetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "Enrollment সংরক্ষণ করা যায়নি।")); }
    else { setError(false); setMessage(selectedEnrollment ? "কোচিং বিষয় ও শিক্ষার্থীর fee আপডেট হয়েছে।" : "শিক্ষার্থীকে কোচিং ব্যাচে ভর্তি করা হয়েছে।"); closeEditor(); await load(); }
    setSaving(false);
  }

  async function withdraw() {
    if (!selectedEnrollment || !window.confirm("এই শিক্ষার্থীকে কোচিং থেকে বাদ দেবেন? তার platform account ও practice access চালু থাকবে।")) return;
    setSaving(true);
    const result = await apiFetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "withdraw", enrollmentId: selectedEnrollment.id, reason: "অ্যাডমিন কর্তৃক কোচিং enrollment বন্ধ" }) });
    if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "Enrollment বন্ধ করা যায়নি।")); }
    else { setError(false); setMessage("কোচিং enrollment বন্ধ হয়েছে; platform account অপরিবর্তিত আছে।"); closeEditor(); await load(); }
    setSaving(false);
  }

  return <section className="space-y-5" aria-labelledby="coaching-enrollment-title">
    <header className="rounded-3xl bg-[linear-gradient(125deg,#0b2545,#123a6b_70%,#174d82)] p-6 text-white shadow-lg sm:p-8"><p className="text-xs font-black uppercase tracking-[.22em] text-brand-yellow">Student enrollment</p><h1 id="coaching-enrollment-title" className="mt-2 text-3xl font-black">শিক্ষার্থী ভর্তি ব্যবস্থাপনা</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Website-এ নিবন্ধন ও কোচিংয়ে ভর্তি আলাদা। একটি Batch-এ ভর্তি করার সময় শিক্ষার্থীর বিষয় ও মাসিক ফি নির্ধারণ করুন।</p></header>
    {message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}
    {selectedStudent && <div className="rounded-2xl border border-primary/20 bg-card p-3 space-y-2"><Label htmlFor="coaching-student-id">Permanent Student ID</Label>{studentCodeContext && !selectedEnrollment && (<p className="text-xs text-muted">{studentCodeContext.yearRequired ? "Batch name must include a four-digit year before IDs can be assigned." : studentCodeContext.lastStudentCode ? <>Last assigned: <span className="font-mono font-black text-primary">{studentCodeContext.lastStudentCode}</span>{studentCodeContext.nextStudentCode && <> · Next suggested: <span className="font-mono font-black text-primary">{studentCodeContext.nextStudentCode}</span></>}</> : studentCodeContext.nextStudentCode ? <>Next suggested: <span className="font-mono font-black text-primary">{studentCodeContext.nextStudentCode}</span></> : null}</p>)}<Input id="coaching-student-id" className="font-mono font-black" readOnly={idFieldLocked || assigningStudentId || Boolean(selectedEnrollment)} value={studentCodeDraft} onChange={(event) => setStudentCodeDraft(event.target.value.replace(/\D/g, "").slice(0, 7))} placeholder={batchId ? (assigningStudentId ? "Assigning…" : studentCodeContext?.nextStudentCode ?? "Enter 7-digit ID") : "Select a batch to assign ID"} inputMode="numeric" maxLength={7} />{!selectedEnrollment && !idFieldLocked && batchId && !assigningStudentId && <Button type="button" variant="outline" size="sm" onClick={() => void applyManualStudentCode()} disabled={!isValidStudentCodeDraft(studentCodeDraft.trim(), studentCodeContext?.prefix ?? null)}>Apply ID</Button>}</div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4"><div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="নাম, Student ID বা reference দিয়ে খুঁজুন" /></div><select className={selectClass} value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}><option value="">সব ব্যাচ</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></div>
        {candidates.length > 0 && <div className="rounded-2xl border border-dashed border-primary/40 bg-secondary/30 p-3"><p className="mb-2 text-xs font-black text-primary">Website-এ নিবন্ধিত, কিন্তু কোচিংয়ে ভর্তি নয়</p>{candidates.map((student) => <button type="button" key={student.id} onClick={() => chooseStudent(student)} className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-white"><span><b>{student.name}</b><small className="ml-2 text-muted">{student.studentCode ? `ID ${student.studentCode}` : "ID ভর্তি হলে স্বয়ংক্রিয় হবে"}{student.reference && ` • #${student.reference}`}</small></span><span className="inline-flex items-center gap-1 text-xs font-bold text-primary"><UserPlus className="size-4" /> ভর্তি করুন</span></button>)}</div>}
        {loading ? <div className="h-56 animate-pulse rounded-3xl bg-secondary" /> : visibleEnrollments.length === 0 ? <div className="rounded-3xl border border-dashed border-border p-10 text-center"><UsersRound className="mx-auto size-9 text-muted" /><p className="mt-3 font-bold text-primary">কোনো ভর্তি পাওয়া যায়নি</p></div> : <div className="space-y-2">{visibleEnrollments.map((item) => <button type="button" key={item.id} onClick={() => chooseEnrollment(item)} className={cn("w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50", selectedEnrollment?.id === item.id ? "border-primary ring-2 ring-primary/10" : "border-border")}><p className="font-black text-primary">{item.student.name}</p><p className="text-xs text-muted">{item.student.studentCode ? `ID ${item.student.studentCode} • ` : ""}{item.student.reference ? `#${item.student.reference} • ` : ""}{item.batch?.name}</p><div className="mt-2 flex flex-wrap gap-1.5">{item.subjects.map((subject) => <span key={subject.id} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-primary">{subject.nameBn || subject.name}</span>)}</div></button>)}</div>}
      </div>
      <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-md)] xl:sticky xl:top-24">{!selectedStudent ? <div className="grid min-h-72 place-items-center text-center"><div><UsersRound className="mx-auto size-10 text-muted" /><p className="mt-3 font-black text-primary">একজন শিক্ষার্থী নির্বাচন করুন</p><p className="mt-1 text-sm text-muted">নতুন ভর্তি বা বর্তমান বিষয় পরিবর্তন করতে বাম পাশ থেকে নির্বাচন করুন।</p></div></div> : <form onSubmit={save} className="space-y-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">{selectedEnrollment ? "Enrollment update" : "New enrollment"}</p><h2 className="mt-1 text-xl font-black text-primary">{selectedStudent.name}</h2></div><button type="button" aria-label="বন্ধ করুন" onClick={closeEditor}><X className="size-5 text-muted" /></button></div><div className="space-y-2"><Label htmlFor="coaching-batch">ব্যাচ</Label><select id="coaching-batch" className={selectClass} required value={batchId} onChange={(event) => { setBatchId(event.target.value); setSubjects([]); setSubjectIds([]); }}><option value="">ব্যাচ নির্বাচন করুন</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select>{selectedEnrollment && batchId !== selectedEnrollment.batchId && <p className="text-xs font-bold text-amber-700">সংরক্ষণ করলে historical enrollment রেখে নতুন ব্যাচে transfer হবে।</p>}</div><fieldset><legend className="text-sm font-bold text-primary">কোচিং বিষয়</legend>{batchId && subjects.length === 0 ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">এই ব্যাচের বিষয় configuration নেই। Academic setup থেকে আগে configure করুন।</p> : <div className="mt-2 space-y-2">{subjects.map((subject) => { const checked = subjectIds.includes(subject.id); return <button type="button" key={subject.id} aria-pressed={checked} onClick={() => setSubjectIds((current) => checked ? current.filter((id) => id !== subject.id) : [...current, subject.id])} className={cn("flex w-full items-center rounded-xl border p-3 text-left", checked ? "border-primary bg-secondary" : "border-border")}><span className="flex items-center gap-2"><span className={cn("grid size-5 place-items-center rounded border", checked ? "border-primary bg-primary text-white" : "border-border")}>{checked && <Check className="size-3.5" />}</span><b className="text-sm text-primary">{subject.nameBn || subject.name}</b></span></button>; })}</div>}</fieldset><div className="space-y-2"><Label htmlFor="student-fee">এই শিক্ষার্থীর মাসিক fee (৳)</Label><Input id="student-fee" type="number" min={0} required value={feeTk} onChange={(event) => setFeeTk(Number(event.target.value))} /></div><div className="grid gap-3 sm:grid-cols-[1fr_145px]"><div className="space-y-2"><Label htmlFor="guardian-phone">Guardian phone</Label><Input id="guardian-phone" required inputMode="tel" pattern="\+?[0-9]{10,15}" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value.replace(/[^+0-9]/g, "").slice(0, 16))} placeholder="01XXXXXXXXX" /></div><div className="space-y-2"><Label htmlFor="guardian-relation">Relation</Label><select id="guardian-relation" required className={selectClass} value={guardianRelation} onChange={(event) => setGuardianRelation(event.target.value)}><option value="father">Father</option><option value="mother">Mother</option><option value="brother">Brother</option><option value="sister">Sister</option><option value="uncle">Uncle</option><option value="aunt">Aunt</option><option value="other">Other</option></select></div></div><Button className="w-full" size="lg" disabled={saving || !subjectIds.length || !/^\+?[0-9]{10,15}$/.test(guardianPhone.trim())}>{saving ? "সংরক্ষণ হচ্ছে…" : "Enrollment সংরক্ষণ করুন"}</Button>{selectedEnrollment && <Button type="button" variant="outline" className="w-full" disabled={saving} onClick={() => void withdraw()}>কোচিং থেকে বাদ দিন</Button>}</form>}</aside>
    </div>
  </section>;
}
