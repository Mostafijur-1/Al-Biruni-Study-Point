"use client";

import { useEffect, useState } from "react";
import { FilePenLine } from "lucide-react";
import { apiFetch, isApiSuccess } from "@/lib/api/client";

type Exam = { id: string; title: string; batchName?: string; subjectName?: string; examDate: string; totalMarks: number; marks: number; comment?: string };

export function StudentWrittenResults() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void apiFetch<{ exams: Exam[] }>("/api/written-exams").then((result) => { if (result.ok && isApiSuccess(result.payload)) setExams(result.payload.data.exams); setLoading(false); }); }, []);
  return <section className="space-y-4"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Published only</p><h2 className="mt-1 text-2xl font-black text-primary">Written exam results</h2><p className="mt-1 text-sm text-muted">Draft marks remain private until your teacher or admin explicitly publishes them.</p></div>{loading ? <div className="h-28 animate-pulse rounded-2xl bg-secondary" /> : exams.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted">No written-exam result has been published yet.</div> : <div className="grid gap-3 md:grid-cols-2">{exams.map((exam) => { const percentage = Math.round((exam.marks / exam.totalMarks) * 1000) / 10; return <article key={exam.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><FilePenLine className="size-5" /></span><strong className="text-2xl text-primary">{exam.marks}/{exam.totalMarks}</strong></div><h3 className="mt-3 font-black text-primary">{exam.title}</h3><p className="mt-1 text-xs text-muted">{exam.subjectName} · {exam.batchName} · {new Date(exam.examDate).toLocaleDateString("en-GB")}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percentage)}%` }} /></div><p className="mt-1 text-right text-xs font-black text-primary">{percentage}%</p>{exam.comment && <p className="mt-3 rounded-xl bg-secondary p-3 text-sm text-primary">{exam.comment}</p>}</article>; })}</div>}</section>;
}
