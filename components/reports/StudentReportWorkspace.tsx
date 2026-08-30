"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, MessageSquareText, Search, TrendingUp } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import type { StudentReport } from "@/lib/student-report-service";

type Student = { id: string; name: string; studentCode?: string; batchName: string; enrollmentStatus?: string };
const pct = (value: number | null) => value === null ? "—" : `${value}%`;

export function StudentReportWorkspace({ role }: { role: "admin" | "teacher" | "student" }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<StudentReport>();
  const [query, setQuery] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadReport = useCallback(async (target = studentId) => {
    setLoading(true); setMessage("");
    const params = new URLSearchParams({ period, date });
    if (role !== "student" && target) params.set("studentId", target);
    const result = await apiFetch<{ report: StudentReport }>(`/api/student-reports?${params}`);
    setLoading(false);
    if (result.ok && isApiSuccess(result.payload)) { setReport(result.payload.data.report); setIsError(false); }
    else { setReport(undefined); setIsError(true); setMessage(getApiErrorMessage(result.payload, "Report could not be loaded.")); }
  }, [date, period, role, studentId]);

  useEffect(() => {
    if (role === "student") { const timer = window.setTimeout(() => void loadReport(), 0); return () => window.clearTimeout(timer); }
    void apiFetch<{ students: Student[] }>("/api/student-reports").then((result) => { if (result.ok && isApiSuccess(result.payload)) setStudents(result.payload.data.students); setLoading(false); });
  }, [loadReport, role]);

  const visible = useMemo(() => { const term = query.trim().toLowerCase(); return students.filter((student) => !term || `${student.name} ${student.studentCode ?? ""} ${student.batchName}`.toLowerCase().includes(term)); }, [query, students]);

  async function addComment(event: FormEvent) {
    event.preventDefault(); if (!report || !comment.trim()) return;
    setSaving(true);
    const result = await apiFetch("/api/student-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: report.student.id, period, date, comment }) });
    setSaving(false);
    if (!result.ok || !isApiSuccess(result.payload)) { setIsError(true); setMessage(getApiErrorMessage(result.payload, "Comment could not be saved.")); return; }
    setComment(""); setIsError(false); setMessage("Comment added to this report period."); await loadReport(report.student.id);
  }

  const mcqAverage = report?.weeklyMcqTests.length ? Math.round(report.weeklyMcqTests.reduce((sum, row) => sum + row.percentage, 0) / report.weeklyMcqTests.length * 10) / 10 : null;
  const writtenAverage = report?.writtenExams.length ? Math.round(report.writtenExams.reduce((sum, row) => sum + row.percentage, 0) / report.writtenExams.length * 10) / 10 : null;

  return <div className="space-y-6">
    <header className="rounded-3xl bg-[radial-gradient(circle_at_88%_14%,rgba(255,198,40,.28),transparent_30%),linear-gradient(125deg,#09233f,#124d78)] p-6 text-white shadow-lg sm:p-8"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-yellow">Progress intelligence</p><h1 className="mt-2 text-3xl font-black">Student reports</h1><p className="mt-2 max-w-3xl text-sm text-white/75">Attendance, daily MCQ practice, weekly tests, written exams, and staff comments in one weekly or monthly view.</p></header>
    {message && <Alert variant={isError ? "destructive" : "success"}>{message}</Alert>}
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"><label className="space-y-1 text-xs font-black text-primary"><span>Report period</span><select className="h-11 rounded-xl border border-input bg-white px-3" value={period} onChange={(event) => setPeriod(event.target.value as "week" | "month")}><option value="week">Weekly report</option><option value="month">Monthly report</option></select></label><label className="space-y-1 text-xs font-black text-primary"><span>Reference date</span><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><Button onClick={() => void loadReport()} disabled={loading || (role !== "student" && !studentId)}><CalendarRange className="size-4" />Generate report</Button>{role === "admin" && report && <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-white px-4 text-sm font-bold text-primary hover:bg-secondary" href={`/api/student-reports/pdf?studentId=${report.student.id}&period=${period}&date=${date}`}><Download className="size-4" />Download PDF</a>}</div>
    <div className={`grid gap-6 ${role === "student" ? "" : "xl:grid-cols-[310px_minmax(0,1fr)]"}`}>
      {role !== "student" && <aside className="h-fit space-y-3 rounded-3xl border border-border bg-card p-4 xl:sticky xl:top-24"><div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, or batch" /></div><div className="max-h-[65vh] space-y-2 overflow-y-auto">{visible.map((student) => <button type="button" key={student.id} onClick={() => { setStudentId(student.id); void loadReport(student.id); }} className={`w-full rounded-xl border p-3 text-left ${studentId === student.id ? "border-primary bg-secondary" : "border-border"}`}><b className="text-sm text-primary">{student.name}</b><p className="mt-1 text-xs text-muted"><span className="font-mono font-black">{student.studentCode ?? "No ID"}</span> · {student.batchName}</p>{student.enrollmentStatus !== "active" && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 text-[10px] font-black text-amber-800">{student.enrollmentStatus}</span>}</button>)}</div></aside>}
      <main>{!report ? <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-border bg-card text-center"><div><TrendingUp className="mx-auto size-10 text-muted" /><h2 className="mt-3 text-xl font-black text-primary">{loading ? "Preparing report…" : role === "student" ? "No report available" : "Select a student"}</h2></div></div> : <div className="space-y-5">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-sm font-black text-accent-foreground">ID {report.student.studentCode ?? "—"}</p><h2 className="text-2xl font-black text-primary">{report.student.name}</h2><p className="text-sm text-muted">{report.batch.name} · {new Date(report.periodStart).toLocaleDateString("en-GB")} – {new Date(report.periodEnd).toLocaleDateString("en-GB")}</p></div>{role === "admin" && <div className="rounded-2xl bg-secondary px-4 py-3 text-right"><p className="text-[10px] font-black uppercase text-muted">Guardian</p><p className="font-mono font-black text-primary">{report.guardian.phone || "Not recorded"}</p><p className="text-xs capitalize text-muted">{report.guardian.relation}</p></div>}</div></section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Attendance", pct(report.attendance.percentage), `${report.attendance.present} P · ${report.attendance.absent} A · ${report.attendance.late} L · ${report.attendance.excused} E`], ["Daily practice", pct(report.dailyMcqPractice.averagePercent), `${report.dailyMcqPractice.attempts} attempts`], ["Weekly MCQ", pct(mcqAverage), `${report.weeklyMcqTests.length} tests`], ["Written", pct(writtenAverage), `${report.writtenExams.length} exams`]].map(([label, value, detail]) => <article key={label} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-black uppercase text-muted">{label}</p><strong className="mt-2 block text-3xl text-primary">{value}</strong><p className="mt-1 text-xs text-muted">{detail}</p></article>)}</section>
        {report.weeklyBreakdown.length > 0 && <section className="overflow-x-auto rounded-3xl border border-border bg-card"><div className="p-4"><h3 className="font-black text-primary">Monthly weekly breakdown</h3><p className="text-xs text-muted">The monthly summary combines its weekly reports.</p></div><table className="min-w-full text-sm"><thead className="bg-secondary text-left text-xs uppercase text-muted"><tr><th className="px-4 py-3">Week</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Practice</th><th className="px-4 py-3">MCQ</th><th className="px-4 py-3">Written</th></tr></thead><tbody>{report.weeklyBreakdown.map((week) => <tr key={week.start} className="border-t border-border"><td className="px-4 py-3 font-bold">{new Date(week.start).toLocaleDateString("en-GB")} – {new Date(week.end).toLocaleDateString("en-GB")}</td><td className="px-4 py-3">{pct(week.attendancePercent)}</td><td className="px-4 py-3">{pct(week.practiceAverage)}</td><td className="px-4 py-3">{pct(week.mcqTestAverage)}</td><td className="px-4 py-3">{pct(week.writtenAverage)}</td></tr>)}</tbody></table></section>}
        <div className="grid gap-4 lg:grid-cols-2"><ResultList title="Published MCQ tests" empty="No published MCQ test in this period." rows={report.weeklyMcqTests.map((row) => ({ title: row.title, detail: `${row.subject} · ${row.score}/${row.totalMarks} · ${row.percentage}%` }))} /><ResultList title="Published written exams" empty="No published written result in this period." rows={report.writtenExams.map((row) => ({ title: row.title, detail: `${row.subject} · ${row.marks}/${row.totalMarks} · ${row.percentage}%`, note: row.comment }))} /></div>
        <section className="rounded-3xl border border-border bg-card p-5"><div className="flex items-center gap-2"><MessageSquareText className="size-5 text-primary" /><h3 className="font-black text-primary">Teacher & admin comments</h3></div>{report.comments.length === 0 ? <p className="mt-3 text-sm text-muted">No comment for this period.</p> : <div className="mt-3 space-y-2">{report.comments.map((row) => <blockquote key={row.id} className="rounded-xl border-l-4 border-primary bg-secondary p-3"><p className="text-sm text-primary">{row.comment}</p><footer className="mt-1 text-xs font-bold text-muted">{row.authorName} · {row.authorRole}</footer></blockquote>)}</div>}{role !== "student" && <form onSubmit={addComment} className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add an observation" /><Button disabled={saving || !comment.trim()}>{saving ? "Saving…" : "Add comment"}</Button></form>}</section>
      </div>}</main>
    </div>
  </div>;
}

function ResultList({ title, empty, rows }: { title: string; empty: string; rows: Array<{ title: string; detail: string; note?: string }> }) {
  return <section className="rounded-3xl border border-border bg-card p-5"><h3 className="font-black text-primary">{title}</h3>{rows.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : <div className="mt-3 space-y-2">{rows.map((row, index) => <div key={`${row.title}-${index}`} className="rounded-xl bg-secondary p-3"><b className="text-sm text-primary">{row.title}</b><p className="text-xs text-muted">{row.detail}</p>{row.note && <p className="mt-1 text-xs text-primary">{row.note}</p>}</div>)}</div>}</section>;
}
