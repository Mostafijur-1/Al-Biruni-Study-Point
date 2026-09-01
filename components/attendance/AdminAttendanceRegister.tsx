"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Search, Sheet } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceRow = { id: string; studentCode?: string; studentName: string; date: string; status: AttendanceStatus; minutesLate?: number; batchName: string; subjectName: string };
type RegisterData = { rows: AttendanceRow[]; batches: Array<{ id: string; name: string; code?: string }>; missingStudentCodeCount: number; truncated: boolean };

const statusLabel: Record<AttendanceStatus, string> = {
  present: "P — Present", absent: "A — Absent", late: "L — Late", excused: "E — Excused",
};

export function AdminAttendanceRegister() {
  const [data, setData] = useState<RegisterData>({ rows: [], batches: [], missingStudentCodeCount: 0, truncated: false });
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [assigningIds, setAssigningIds] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (batchId) params.set("batchId", batchId);
    if (date) params.set("date", date);
    const result = await apiFetch<RegisterData>(`/api/admin/attendance?${params}`);
    if (result.ok && isApiSuccess(result.payload)) { setData(result.payload.data); setMessage(""); setError(false); }
    else { setMessage(getApiErrorMessage(result.payload, "Attendance Register লোড করা যায়নি।")); setError(true); }
    setLoading(false);
  }, [batchId, date]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? data.rows.filter((row) => `${row.studentCode ?? ""} ${row.studentName} ${row.batchName} ${row.subjectName}`.toLowerCase().includes(term)) : data.rows;
  }, [data.rows, search]);

  async function assignExistingIds() {
    if (!window.confirm("যেসব Active Batch শিক্ষার্থীর স্থায়ী ID নেই, তাদের সবাইকে ID দিতে চান?")) return;
    setAssigningIds(true);
    const result = await apiFetch<{ assignedCount: number }>("/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "backfill-student-codes" }),
    });
    if (result.ok && isApiSuccess(result.payload)) {
      await load();
      setMessage(`${result.payload.data.assignedCount}টি স্থায়ী Student ID দেওয়া হয়েছে।`);
      setError(false);
    } else {
      setMessage(getApiErrorMessage(result.payload, "বর্তমান শিক্ষার্থীদের Student ID দেওয়া যায়নি।"));
      setError(true);
    }
    setAssigningIds(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]" aria-labelledby="admin-attendance-title">
      <header className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-accent-foreground"><Sheet className="size-4" /> Attendance Register</p><h2 id="admin-attendance-title" className="mt-1 text-xl font-black text-primary">সব Batch ও Class</h2><p className="mt-1 text-xs text-muted">Submit করা Attendance এখানে স্থায়ী spreadsheet-style Register হিসেবে দেখা যাবে।</p></div>
          <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-primary">{visibleRows.length} rows</span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_180px]">
          <label className="relative"><span className="sr-only">Attendance Search</span><Search className="absolute left-3 top-3.5 size-4 text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="ID, শিক্ষার্থী, Batch বা বিষয় Search করুন" /></label>
          <select aria-label="Batch দিয়ে Filter করুন" value={batchId} onChange={(event) => setBatchId(event.target.value)} className="h-11 rounded-xl border border-input bg-white px-3 text-sm"><option value="">সব Batch</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select>
          <label className="relative"><span className="sr-only">তারিখ দিয়ে Filter করুন</span><CalendarDays className="absolute left-3 top-3.5 size-4 text-muted" /><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="pl-9" /></label>
        </div>
        {data.missingStudentCodeCount > 0 && <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-900"><span>{data.missingStudentCodeCount} জন বর্তমান শিক্ষার্থীর এখনো স্থায়ী ID নেই। নতুন Batch Enrollment-এ স্বয়ংক্রিয়ভাবে ID দেওয়া হয়।</span><Button type="button" size="sm" variant="outline" className="ml-3" disabled={assigningIds} onClick={() => void assignExistingIds()}><RefreshCw className={cn("size-4", assigningIds && "animate-spin")} /> বর্তমান ID দিন</Button></Alert>}
        {data.truncated && <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-900">শুধু সর্বশেষ ৫,০০০টি Attendance row দেখানো হচ্ছে। Register ছোট করতে Batch বা তারিখ দিয়ে Filter করুন।</Alert>}
        {message && <Alert variant={error ? "destructive" : "success"} className="mt-3">{message}</Alert>}
      </header>
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase tracking-wide text-muted"><tr><th className="w-12 border-b border-r border-border px-3 py-2 text-center">#</th><th className="border-b border-r border-border px-3 py-2">Student ID</th><th className="border-b border-r border-border px-3 py-2">শিক্ষার্থীর নাম</th><th className="border-b border-r border-border px-3 py-2">তারিখ</th><th className="border-b border-r border-border px-3 py-2">Attendance Status</th><th className="border-b border-r border-border px-3 py-2">Batch</th><th className="border-b border-border px-3 py-2">Class / বিষয়</th></tr></thead>
          <tbody>{loading ? Array.from({ length: 6 }, (_, index) => <tr key={index}><td colSpan={7} className="border-b border-border p-3"><div className="h-5 animate-pulse rounded bg-secondary" /></td></tr>) : visibleRows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted">এই Filter-এ Submit করা কোনো Attendance পাওয়া যায়নি।</td></tr> : visibleRows.map((row, index) => (
            <tr key={row.id} className="even:bg-secondary/20 hover:bg-sky-50/60"><td className="border-b border-r border-border px-3 py-2 text-center text-xs text-muted">{index + 1}</td><td className="border-b border-r border-border px-3 py-2 font-mono font-bold text-primary">{row.studentCode ?? "Unassigned"}</td><td className="border-b border-r border-border px-3 py-2 font-semibold">{row.studentName}</td><td className="border-b border-r border-border px-3 py-2 tabular-nums">{new Date(row.date).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "2-digit", year: "numeric" })}</td><td className="border-b border-r border-border px-3 py-2"><span className={cn("inline-flex rounded-md px-2 py-1 text-xs font-black", row.status === "present" ? "bg-emerald-100 text-emerald-700" : row.status === "absent" ? "bg-red-100 text-red-700" : row.status === "late" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-700")}>{statusLabel[row.status]}{row.status === "late" && row.minutesLate ? ` (${row.minutesLate}m)` : ""}</span></td><td className="border-b border-r border-border px-3 py-2">{row.batchName}</td><td className="border-b border-border px-3 py-2">{row.subjectName}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
