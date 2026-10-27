"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, MessageSquareText, Search, TrendingUp } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { downloadStudentReportPdf } from "@/lib/client-report-pdf";
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
  const [downloading, setDownloading] = useState(false);

  const loadReport = useCallback(async (target = studentId) => {
    setLoading(true); setMessage("");
    const params = new URLSearchParams({ period, date });
    if (role !== "student" && target) params.set("studentId", target);
    const result = await apiFetch<{ report: StudentReport }>(`/api/student-reports?${params}`);
    setLoading(false);
    if (result.ok && isApiSuccess(result.payload)) { setReport(result.payload.data.report); setIsError(false); }
    else { setReport(undefined); setIsError(true); setMessage(getApiErrorMessage(result.payload, "Report লোড করা যায়নি।")); }
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
    if (!result.ok || !isApiSuccess(result.payload)) { setIsError(true); setMessage(getApiErrorMessage(result.payload, "Comment Save করা যায়নি।")); return; }
    setComment(""); setIsError(false); setMessage("এই Report Period-এ Comment যোগ হয়েছে।"); await loadReport(report.student.id);
  }

  async function downloadPdf() {
    if (!report) return;
    setDownloading(true); setMessage("");
    try { await downloadStudentReportPdf(report); setIsError(false); }
    catch { setIsError(true); setMessage("এই Device-এ PDF তৈরি করা যায়নি।"); }
    finally { setDownloading(false); }
  }

  const mcqAverage = report?.weeklyMcqTests.length ? Math.round(report.weeklyMcqTests.reduce((sum, row) => sum + row.percentage, 0) / report.weeklyMcqTests.length * 10) / 10 : null;
  const writtenAverage = report?.writtenExams.length ? Math.round(report.writtenExams.reduce((sum, row) => sum + row.percentage, 0) / report.writtenExams.length * 10) / 10 : null;

  return <div className="space-y-6">
    <header className="rounded-3xl bg-[radial-gradient(circle_at_88%_14%,rgba(255,198,40,.28),transparent_30%),linear-gradient(125deg,#09233f,#124d78)] p-6 text-white shadow-lg sm:p-8"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-yellow">Progress Report</p><h1 className="mt-2 text-3xl font-black">Student Report</h1><p className="mt-2 max-w-3xl text-sm text-white/75">Attendance, Daily MCQ Practice, Weekly Test, Written Exam ও Staff Comment—সব একসঙ্গে সাপ্তাহিক বা মাসিক Report-এ দেখুন।</p></header>
    {message && <Alert variant={isError ? "destructive" : "success"}>{message}</Alert>}
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"><label className="space-y-1 text-xs font-black text-primary"><span>Report Period</span><select className="h-11 rounded-xl border border-input bg-white px-3" value={period} onChange={(event) => setPeriod(event.target.value as "week" | "month")}><option value="week">সাপ্তাহিক Report</option><option value="month">মাসিক Report</option></select></label><label className="space-y-1 text-xs font-black text-primary"><span>Reference Date</span><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><Button onClick={() => void loadReport()} disabled={loading || (role !== "student" && !studentId)}><CalendarRange className="size-4" />Report তৈরি করুন</Button>{role === "admin" && report && <Button type="button" variant="outline" disabled={downloading} onClick={() => void downloadPdf()}><Download className="size-4" />{downloading ? "PDF তৈরি হচ্ছে…" : "PDF Download"}</Button>}</div>
    <div className={`grid gap-6 ${role === "student" ? "" : "xl:grid-cols-[310px_minmax(0,1fr)]"}`}>
      {role !== "student" && <aside className="h-fit space-y-3 rounded-3xl border border-border bg-card p-4 xl:sticky xl:top-24"><div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="নাম, ID বা Batch" /></div><div className="max-h-[65vh] space-y-2 overflow-y-auto">{visible.map((student) => <button type="button" key={student.id} onClick={() => { setStudentId(student.id); void loadReport(student.id); }} className={`w-full rounded-xl border p-3 text-left ${studentId === student.id ? "border-primary bg-secondary" : "border-border"}`}><b className="text-sm text-primary">{student.name}</b><p className="mt-1 text-xs text-muted"><span className="font-mono font-black">{student.studentCode ?? "ID নেই"}</span> · {student.batchName}</p>{student.enrollmentStatus !== "active" && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 text-[10px] font-black text-amber-800">{student.enrollmentStatus}</span>}</button>)}</div></aside>}
      <main>{!report ? <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-border bg-card text-center"><div><TrendingUp className="mx-auto size-10 text-muted" /><h2 className="mt-3 text-xl font-black text-primary">{loading ? "Report তৈরি হচ্ছে…" : role === "student" ? "কোনো Report নেই" : "একজন শিক্ষার্থী Select করুন"}</h2></div></div> : <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* TOP HEADER: Logo & আল-বিরুনী স্টাডি পয়েন্ট */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border-b border-border/80 pb-6 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <img
              src="/absp-logo.png"
              alt="ABSP Logo"
              className="size-16 object-contain rounded-2xl bg-primary/5 p-1 border border-primary/20 shrink-0"
            />
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-primary tracking-tight">
                আল-বিরুনী স্টাডি পয়েন্ট
              </h2>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted">
                Al-Biruni Study Point · Student Progress Report
              </p>
            </div>
          </div>
          <div className="text-sm sm:text-right font-medium text-muted">
            <p className="font-mono text-xs font-bold text-accent-foreground">
              Student ID: {report.student.studentCode || "—"}
            </p>
            <p className="font-bold text-foreground">ব্যাচ: {report.batch.name}</p>
            <p className="text-2xs text-muted">
              সময়কাল: {new Date(report.periodStart).toLocaleDateString("en-GB")} – {new Date(report.periodEnd).toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>

        {/* GREETING TO GUARDIAN */}
        <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-bold text-primary">
            প্রিয় অভিভাবক, আপনার সন্তান <span className="font-black text-foreground underline decoration-amber-400 decoration-2">{report.student.name}</span>-এর {report.periodType === "month" ? "এই মাসের" : "এই সপ্তাহের"} রিপোর্ট:
          </h3>
          {report.guardian.phone && (
            <p className="mt-1 text-xs text-muted font-medium">
              Guardian যোগাযোগ: {report.guardian.phone} {report.guardian.relation ? `(${report.guardian.relation})` : ""}
            </p>
          )}
        </div>

        {/* SECTION 1: CLASS ATTENDANCE */}
        <div className="rounded-2xl border border-border bg-background/50 p-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h4 className="text-base font-black text-primary">
              ১. ক্লাস উপস্থিতি (Class Attendance)
            </h4>
            {report.attendance.percentage !== null && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                উপস্থিতির হার: {report.attendance.percentage}%
              </span>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            Total Class হয়েছে <span className="font-mono font-bold text-primary">{report.attendance.total}</span> টি, সে Present ছিল <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{report.attendance.present}</span> টি, সে Absent ছিল <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{report.attendance.absent}</span> টি।
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted font-bold">Total Class হয়েছে</p>
              <p className="mt-1 text-2xl font-black text-primary">{report.attendance.total} টি</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">সে Present ছিল</p>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400">{report.attendance.present} টি</p>
            </div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3 text-center">
              <p className="text-xs text-rose-800 dark:text-rose-300 font-bold">সে Absent ছিল</p>
              <p className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-400">{report.attendance.absent} টি</p>
            </div>
          </div>
        </div>

        {/* SECTION 2: DAILY MCQ PRACTICE */}
        <div className="rounded-2xl border border-border bg-background/50 p-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h4 className="text-base font-black text-primary">
              ২. ডেইলি MCQ এক্সাম (Daily MCQ Exam)
            </h4>
            {report.dailyMcqPractice.averagePercent !== null && (
              <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-xs font-black text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                Overall Result: {report.dailyMcqPractice.averagePercent}%
              </span>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            মোট <span className="font-mono font-bold text-primary">{report.dailyMcqPractice.totalDays}</span> দিনের মধ্যে সে Daily MCQ Exam দিয়েছে <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{report.dailyMcqPractice.daysAttended}</span> দিন, Daily Exam মিস করেছে <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{report.dailyMcqPractice.daysMissed}</span> দিন।
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted font-bold">Daily Exam দিয়েছে</p>
              <p className="mt-1 text-xl font-black text-emerald-600">{report.dailyMcqPractice.daysAttended} দিন</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted font-bold">Daily Exam মিস করেছে</p>
              <p className="mt-1 text-xl font-black text-rose-600">{report.dailyMcqPractice.daysMissed} দিন</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted font-bold">Overall Result (গড়)</p>
              <p className="mt-1 text-xl font-black text-primary">{report.dailyMcqPractice.averagePercent !== null ? `${report.dailyMcqPractice.averagePercent}%` : "—"}</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: WEEKLY MCQ EXAM */}
        <div className="rounded-2xl border border-border bg-background/50 p-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h4 className="text-base font-black text-primary">
              ৩. উইকলি MCQ টেস্ট (Weekly MCQ Exam)
            </h4>
            <span className="text-xs font-bold text-muted">
              মোট: {report.weeklyMcqSummary.total} টি
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            মোট <span className="font-mono font-bold text-primary">{report.weeklyMcqSummary.total}</span> টির মধ্যে সে Weekly MCQ Exam দিয়েছে <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{report.weeklyMcqSummary.attended}</span> টি, Weekly MCQ Exam মিস করেছে <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{report.weeklyMcqSummary.missed}</span> টি।
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">প্রতিটি পরীক্ষার ফলাফল আলাদাভাবে:</p>
            {report.weeklyMcqTests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted">
                এই সময়ে কোনো Weekly MCQ Exam দেওয়া হয়নি বা Publish হয়নি।
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {report.weeklyMcqTests.map((test, index) => (
                  <div key={`${test.title}-${index}`} className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-primary text-sm">{test.title}</p>
                        <p className="text-xs text-muted">{test.subject} · {new Date(test.date).toLocaleDateString("en-GB")}</p>
                      </div>
                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {test.percentage}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      প্রাপ্ত নম্বর: <span className="font-mono font-bold text-primary">{test.score}</span> / <span className="font-mono">{test.totalMarks}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: WRITTEN EXAM */}
        <div className="rounded-2xl border border-border bg-background/50 p-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h4 className="text-base font-black text-primary">
              ৪. লিখিত পরীক্ষা (Written Exam)
            </h4>
            <span className="text-xs font-bold text-muted">
              মোট: {report.writtenExamSummary.total} টি
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            মোট <span className="font-mono font-bold text-primary">{report.writtenExamSummary.total}</span> টির মধ্যে সে Written Exam দিয়েছে <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{report.writtenExamSummary.attended}</span> টি, Written Exam মিস করেছে <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{report.writtenExamSummary.missed}</span> টি।
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">প্রতিটি লিখিত পরীক্ষার ফলাফল আলাদাভাবে:</p>
            {report.writtenExams.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted">
                এই সময়ে কোনো Written Exam দেওয়া হয়নি বা Publish হয়নি।
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {report.writtenExams.map((exam, index) => (
                  <div key={`${exam.title}-${index}`} className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-primary text-sm">{exam.title}</p>
                        <p className="text-xs text-muted">{exam.subject} · {new Date(exam.date).toLocaleDateString("en-GB")}</p>
                      </div>
                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {exam.percentage}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      প্রাপ্ত নম্বর: <span className="font-mono font-bold text-primary">{exam.marks}</span> / <span className="font-mono">{exam.totalMarks}</span>
                    </p>
                    {exam.comment && (
                      <p className="mt-2 rounded-lg bg-secondary/80 p-2 text-xs italic text-primary">
                        শিক্ষকের নোট: "{exam.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: TEACHER COMMENTS */}
        <div className="rounded-2xl border border-border bg-background/50 p-5">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <MessageSquareText className="size-5 text-primary" />
            <h4 className="text-base font-black text-primary">
              ৫. শিক্ষক / কর্তৃপক্ষের মন্তব্য (Teacher Comments)
            </h4>
          </div>
          {report.comments.length === 0 ? (
            <p className="mt-3 text-xs text-muted italic">এই সময়ে কোনো বিশেষ মন্তব্য যোগ করা হয়নি।</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {report.comments.map((row) => (
                <blockquote key={row.id} className="rounded-xl border-l-4 border-primary bg-card p-3.5 shadow-2xs">
                  <p className="text-sm font-medium text-foreground">{row.comment}</p>
                  <footer className="mt-1.5 text-xs font-bold text-muted">
                    — {row.authorName} ({row.authorRole === "teacher" ? "Teacher" : "Admin"})
                  </footer>
                </blockquote>
              ))}
            </div>
          )}
          {role !== "student" && (
            <form onSubmit={addComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="পর্যবেক্ষণ লিখুন" />
              <Button type="submit" disabled={saving || !comment.trim()}>{saving ? "Save হচ্ছে…" : "Comment যোগ করুন"}</Button>
            </form>
          )}
        </div>
      </div>}</main>
    </div>
  </div>;
}

function ResultList({ title, empty, rows }: { title: string; empty: string; rows: Array<{ title: string; detail: string; note?: string }> }) {
  return <section className="rounded-3xl border border-border bg-card p-5"><h3 className="font-black text-primary">{title}</h3>{rows.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : <div className="mt-3 space-y-2">{rows.map((row, index) => <div key={`${row.title}-${index}`} className="rounded-xl bg-secondary p-3"><b className="text-sm text-primary">{row.title}</b><p className="text-xs text-muted">{row.detail}</p>{row.note && <p className="mt-1 text-xs text-primary">{row.note}</p>}</div>)}</div>}</section>;
}
