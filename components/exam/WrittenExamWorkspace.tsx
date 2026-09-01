"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FilePenLine, Save, Send } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";

type Exam = {
  id: string; batchId: string; batchName?: string; subjectId: string; subjectName?: string;
  title: string; examDate: string; totalMarks: number; hasQuestionFile?: boolean;
  questionFileName?: string; instructions?: string; isPublished: boolean;
};
type Batch = { id: string; name: string };
type Subject = { id: string; name: string; nameBn?: string };
type StudentRow = { id: string; name: string; studentCode?: string; marks?: number; comment?: string };
const selectClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

export function WrittenExamWorkspace({ role }: { role: "admin" | "teacher" }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam>();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalMarks, setTotalMarks] = useState(100);
  const [questionLink, setQuestionLink] = useState("");
  const [draftQuestionLink, setDraftQuestionLink] = useState("");
  const [instructions, setInstructions] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [examResult, activeResult, plannedResult] = await Promise.all([
      apiFetch<{ exams: Exam[] }>("/api/written-exams"),
      apiFetch<{ batches: Batch[] }>("/api/batches?status=active&limit=100"),
      apiFetch<{ batches: Batch[] }>("/api/batches?status=planned&limit=100"),
    ]);
    if (examResult.ok && isApiSuccess(examResult.payload)) setExams(examResult.payload.data.exams);
    const available = [activeResult, plannedResult].flatMap((result) => result.ok && isApiSuccess(result.payload) ? result.payload.data.batches : []);
    setBatches([...new Map(available.map((batch) => [batch.id, batch])).values()]);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!batchId) return;
    void apiFetch<{ subjects: Subject[] }>(`/api/coaching-subjects?batchId=${batchId}`).then((result) => {
      setSubjects(result.ok && isApiSuccess(result.payload) ? result.payload.data.subjects : []);
    });
  }, [batchId]);

  async function openExam(exam: Exam) {
    setSelectedExam(exam); setDraftQuestionLink(""); setMessage("");
    const result = await apiFetch<{ students: StudentRow[] }>(`/api/written-exams?examId=${exam.id}`);
    if (result.ok && isApiSuccess(result.payload)) setStudents(result.payload.data.students);
    else { setIsError(true); setMessage(getApiErrorMessage(result.payload, "Student list লোড করা যায়নি।")); }
  }

  async function createExam(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const result = await apiFetch<{ exam: Exam }>("/api/written-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "create", batchId, subjectId, title, examDate, totalMarks,
      ...(instructions.trim() ? { instructions } : {}),
    }) });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setSaving(false); setIsError(true); setMessage(getApiErrorMessage(result.payload, "Written Exam তৈরি করা যায়নি।")); return;
    }
    let questionLinked = false;
    if (questionLink.trim()) {
      const linked = await apiFetch("/api/written-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-question-link", examId: result.payload.data.exam.id, url: questionLink.trim() }) });
      if (!linked.ok || !isApiSuccess(linked.payload)) {
        setSaving(false); setIsError(true); setMessage(`Exam তৈরি হয়েছে, কিন্তু ${getApiErrorMessage(linked.payload, "Google Drive-এর প্রশ্নের Link Save করা যায়নি।")}`); await load(); return;
      }
      questionLinked = true;
    }
    setSaving(false); setIsError(false); setMessage(`Written Exam তৈরি হয়েছে${questionLinked ? " এবং Google Drive-এর প্রশ্নের Link যোগ হয়েছে" : ""}। Marks লিখে Check করার পর Publish করুন।`);
    setTitle(""); setQuestionLink(""); setInstructions(""); await load();
  }

  async function saveQuestionLink(url: string | null) {
    if (!selectedExam || selectedExam.isPublished) return;
    setSaving(true); setMessage("");
    const result = await apiFetch("/api/written-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-question-link", examId: selectedExam.id, url }) });
    setSaving(false);
    if (!result.ok || !isApiSuccess(result.payload)) { setIsError(true); setMessage(getApiErrorMessage(result.payload, "প্রশ্নের Link Update করা যায়নি।")); return; }
    const linked = Boolean(url);
    setSelectedExam({ ...selectedExam, hasQuestionFile: linked, questionFileName: linked ? "Google Drive" : undefined });
    setDraftQuestionLink(""); setIsError(false); setMessage(linked ? "Google Drive-এর প্রশ্নের Link Save হয়েছে।" : "প্রশ্নের Link Remove হয়েছে।"); await load();
  }

  const enteredRows = useMemo(() => students.filter((student) => Number.isFinite(student.marks)), [students]);

  async function saveMarks() {
    if (!selectedExam || !enteredRows.length) return;
    setSaving(true); setMessage("");
    const result = await apiFetch("/api/written-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "save-marks", examId: selectedExam.id,
      results: enteredRows.map((student) => ({ studentId: student.id, marks: student.marks, comment: student.comment })),
    }) });
    setSaving(false);
    if (!result.ok || !isApiSuccess(result.payload)) { setIsError(true); setMessage(getApiErrorMessage(result.payload, "Marks Save করা যায়নি।")); return; }
    setIsError(false); setMessage(`${enteredRows.length} জন শিক্ষার্থীর Marks Draft হিসেবে Save হয়েছে।`);
  }

  async function publish() {
    if (!selectedExam || !window.confirm("Written Exam-এর Marks শিক্ষার্থীদের জন্য Publish করবেন? Publish করার পর Marks Lock হয়ে যাবে।")) return;
    setSaving(true); setMessage("");
    const result = await apiFetch("/api/written-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", examId: selectedExam.id }) });
    setSaving(false);
    if (!result.ok || !isApiSuccess(result.payload)) { setIsError(true); setMessage(getApiErrorMessage(result.payload, "Exam Publish করা যায়নি।")); return; }
    setIsError(false); setMessage("Written Exam-এর Result এখন শিক্ষার্থীরা দেখতে পারবে।"); setSelectedExam({ ...selectedExam, isPublished: true }); await load();
  }

  return <div className="space-y-6">
    <header className="rounded-3xl bg-[linear-gradient(125deg,#081f3b,#123f70_72%,#1c5c8d)] p-6 text-white shadow-lg"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-yellow">Assessment Workflow</p><h1 className="mt-2 text-3xl font-black">Written Exam</h1><p className="mt-2 max-w-3xl text-sm text-white/75">নির্দিষ্ট Batch-এর জন্য Exam তৈরি করুন, চাইলে Google Drive-এর প্রশ্নের Link দিন, Student list থেকে Marks লিখুন এবং Check করার পর Publish করুন।</p></header>
    {message && <Alert variant={isError ? "destructive" : "success"}>{message}</Alert>}
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-5">
        <form onSubmit={createExam} className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">নতুন Written Exam</p><h2 className="mt-1 text-xl font-black text-primary">Exam-এর তথ্য</h2></div>
          <div className="space-y-2"><Label htmlFor="written-batch">Batch</Label><select id="written-batch" required className={selectClass} value={batchId} onChange={(event) => { setBatchId(event.target.value); setSubjectId(""); setSubjects([]); }}><option value="">Batch Select করুন</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="written-subject">বিষয়</Label><select id="written-subject" required className={selectClass} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">বিষয় Select করুন</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.nameBn || subject.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="written-title">Exam-এর নাম</Label><Input id="written-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Weekly Written Exam 01" /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="written-date">Exam-এর তারিখ</Label><Input id="written-date" required type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="written-total">মোট Marks</Label><Input id="written-total" required type="number" min={1} value={totalMarks} onChange={(event) => setTotalMarks(Number(event.target.value))} /></div></div>
          <div className="space-y-2"><Label htmlFor="written-instructions">নির্দেশনা (ঐচ্ছিক)</Label><textarea id="written-instructions" className="min-h-20 w-full rounded-xl border border-input p-3 text-sm" value={instructions} onChange={(event) => setInstructions(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="written-question">Google Drive-এর প্রশ্নের Link (ঐচ্ছিক)</Label><Input id="written-question" type="url" value={questionLink} onChange={(event) => setQuestionLink(event.target.value)} placeholder="https://drive.google.com/file/d/..." /><p className="text-xs text-muted">প্রশ্নটি এই Website-এ Upload হবে না। Google Drive-এর Sharing Permission কার্যকর থাকবে।</p></div>
          <Button className="w-full" disabled={saving || !batchId || !subjectId}><FilePenLine className="size-4" />{saving ? "তৈরি হচ্ছে…" : "Written Exam তৈরি করুন"}</Button>
        </form>
        <section className="space-y-2"><h2 className="font-black text-primary">সব Written Exam</h2>{exams.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted">এখনো কোনো Written Exam নেই।</p> : exams.map((exam) => <button type="button" key={exam.id} onClick={() => void openExam(exam)} className={`w-full rounded-2xl border bg-card p-4 text-left shadow-sm ${selectedExam?.id === exam.id ? "border-primary ring-2 ring-primary/10" : "border-border"}`}><div className="flex items-start justify-between gap-2"><div><b className="text-primary">{exam.title}</b><p className="mt-1 text-xs text-muted">{exam.batchName} · {exam.subjectName} · {new Date(exam.examDate).toLocaleDateString("en-GB")}</p>{exam.hasQuestionFile && <p className="mt-1 text-xs font-bold text-primary">প্রশ্ন যুক্ত আছে</p>}</div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${exam.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{exam.isPublished ? "Published" : "Draft"}</span></div></button>)}</section>
      </div>
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        {!selectedExam ? <div className="grid min-h-96 place-items-center text-center"><div><FilePenLine className="mx-auto size-10 text-muted" /><h2 className="mt-3 text-xl font-black text-primary">একটি Exam Select করুন</h2><p className="mt-1 text-sm text-muted">Marks দেওয়ার জন্য ওই Batch-এর Student list খুলবে।</p></div></div> : <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black text-primary">{selectedExam.title}</h2><p className="text-sm text-muted">সর্বোচ্চ {selectedExam.totalMarks} Marks · {students.length} জন Active শিক্ষার্থী</p>{selectedExam.hasQuestionFile && <a className="mt-1 inline-block text-xs font-bold text-primary underline" target="_blank" rel="noreferrer" href={`/api/written-exams?examId=${selectedExam.id}&question=true`}>প্রশ্নের Source খুলুন</a>}</div>{selectedExam.isPublished && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700"><CheckCircle2 className="size-4" />Published</span>}</div>
          {!selectedExam.isPublished && <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-secondary/40 p-3"><div className="min-w-64 flex-1 space-y-1"><Label htmlFor="draft-question-link">Google Drive-এর প্রশ্নের Link (ঐচ্ছিক)</Label><Input id="draft-question-link" type="url" value={draftQuestionLink} onChange={(event) => setDraftQuestionLink(event.target.value)} placeholder={selectedExam.hasQuestionFile ? "বর্তমান Source বদলাতে নতুন Link Paste করুন" : "https://drive.google.com/file/d/..."} /></div><Button type="button" variant="outline" disabled={saving || !draftQuestionLink.trim()} onClick={() => void saveQuestionLink(draftQuestionLink.trim())}>Link Save করুন</Button>{selectedExam.hasQuestionFile && <Button type="button" variant="outline" disabled={saving} onClick={() => void saveQuestionLink(null)}>Link Remove করুন</Button>}</div>}
          <div className="overflow-x-auto rounded-2xl border border-border"><table className="min-w-full text-sm"><thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-3">Student ID</th><th className="px-3 py-3">শিক্ষার্থী</th><th className="px-3 py-3">Marks / {selectedExam.totalMarks}</th><th className="px-3 py-3">Comment</th></tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-t border-border"><td className="px-3 py-2 font-mono font-black text-primary">{student.studentCode ?? "—"}</td><td className="px-3 py-2 font-bold">{student.name}</td><td className="px-3 py-2"><Input aria-label={`${student.name} marks`} disabled={selectedExam.isPublished} className="w-28" type="number" min={0} max={selectedExam.totalMarks} value={student.marks ?? ""} onChange={(event) => setStudents((current) => current.map((row) => row.id === student.id ? { ...row, marks: event.target.value === "" ? undefined : Number(event.target.value) } : row))} /></td><td className="px-3 py-2"><Input aria-label={`${student.name} comment`} disabled={selectedExam.isPublished} value={student.comment ?? ""} onChange={(event) => setStudents((current) => current.map((row) => row.id === student.id ? { ...row, comment: event.target.value } : row))} /></td></tr>)}</tbody></table></div>
          {!selectedExam.isPublished && <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={saving || !enteredRows.length} onClick={() => void saveMarks()}><Save className="size-4" />Draft Marks Save করুন</Button><Button disabled={saving || !enteredRows.length} onClick={() => void publish()}><Send className="size-4" />শিক্ষার্থীদের জন্য Publish করুন</Button></div>}
        </div>}
      </section>
    </div>
    {role === "admin" && <p className="text-xs text-muted">Admin সব Batch দেখতে পারবেন। Teacher শুধু নিজের বর্তমান Batch ও Assigned Subject-এর Exam দেখবেন।</p>}
  </div>;
}
