"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Download,
  HelpCircle,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Sheet,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceRow = {
  id: string;
  studentId: string;
  studentCode?: string;
  studentName: string;
  date: string;
  status: AttendanceStatus;
  minutesLate?: number;
  batchId: string;
  batchName: string;
  subjectName: string;
};
type RegisterData = {
  rows: AttendanceRow[];
  batches: Array<{ id: string; name: string; code?: string }>;
  missingStudentCodeCount: number;
  truncated: boolean;
};

type StudentMatrixRow = {
  studentId: string;
  studentCode?: string;
  studentName: string;
  batchName: string;
  records: Record<string, { status: AttendanceStatus; minutesLate?: number; subjectName: string }>;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  totalMarked: number;
  rate: number;
};

const statusLabel: Record<AttendanceStatus, string> = {
  present: "P — Present",
  absent: "A — Absent",
  late: "L — Late",
  excused: "E — Excused",
};

const statusBadgeClasses: Record<AttendanceStatus, string> = {
  present: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  absent: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  late: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  excused: "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800",
};

function formatIsoDateKey(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const year = d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka", year: "numeric" });
    const month = d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka", month: "2-digit" });
    const day = d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka", day: "2-digit" });
    return `${year}-${month}-${day}`;
  } catch {
    return isoDate.slice(0, 10);
  }
}

function formatDateHeader(dateKey: string): { top: string; day: string } {
  try {
    const d = new Date(`${dateKey}T12:00:00+06:00`);
    const top = d.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short" });
    const day = d.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", weekday: "short" });
    return { top, day };
  } catch {
    return { top: dateKey, day: "" };
  }
}

export function AdminAttendanceRegister() {
  const [data, setData] = useState<RegisterData>({
    rows: [],
    batches: [],
    missingStudentCodeCount: 0,
    truncated: false,
  });
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"sheet" | "log">("sheet");
  const [sortAsc, setSortAsc] = useState(true);
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
    if (result.ok && isApiSuccess(result.payload)) {
      setData(result.payload.data);
      setMessage("");
      setError(false);
    } else {
      setMessage(getApiErrorMessage(result.payload, "Attendance Register লোড করা যায়নি।"));
      setError(true);
    }
    setLoading(false);
  }, [batchId, date]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? data.rows.filter((row) =>
          `${row.studentCode ?? ""} ${row.studentName} ${row.batchName} ${row.subjectName}`
            .toLowerCase()
            .includes(term),
        )
      : data.rows;
  }, [data.rows, search]);

  // Transform flat records into Google Sheet Matrix (Students on left, Dates across top)
  const { dateColumns, matrixRows, dailyTotals } = useMemo(() => {
    const dateSet = new Set<string>();
    const studentMap = new Map<string, StudentMatrixRow>();

    for (const row of visibleRows) {
      const dateKey = formatIsoDateKey(row.date);
      dateSet.add(dateKey);

      const studentKey = row.studentId || row.studentCode || row.studentName;
      let student = studentMap.get(studentKey);
      if (!student) {
        student = {
          studentId: row.studentId,
          studentCode: row.studentCode,
          studentName: row.studentName,
          batchName: row.batchName,
          records: {},
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          totalMarked: 0,
          rate: 0,
        };
        studentMap.set(studentKey, student);
      }

      student.records[dateKey] = {
        status: row.status,
        minutesLate: row.minutesLate,
        subjectName: row.subjectName,
      };

      if (row.status === "present") student.presentCount++;
      else if (row.status === "absent") student.absentCount++;
      else if (row.status === "late") student.lateCount++;
      else if (row.status === "excused") student.excusedCount++;

      student.totalMarked++;
    }

    // Sort dates
    const sortedDates = Array.from(dateSet).sort((a, b) =>
      sortAsc ? a.localeCompare(b) : b.localeCompare(a),
    );

    // Calculate rates and sort students
    const rows = Array.from(studentMap.values()).map((st) => {
      st.rate =
        st.totalMarked > 0
          ? Math.round(((st.presentCount + st.lateCount) / st.totalMarked) * 100)
          : 0;
      return st;
    });

    rows.sort((a, b) => {
      if (a.studentCode && b.studentCode) {
        return a.studentCode.localeCompare(b.studentCode);
      }
      return a.studentName.localeCompare(b.studentName);
    });

    // Compute column-wise totals
    const dailyTotals: Record<
      string,
      { present: number; absent: number; late: number; excused: number; total: number }
    > = {};
    for (const d of sortedDates) {
      dailyTotals[d] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    }
    for (const st of rows) {
      for (const d of sortedDates) {
        const mark = st.records[d];
        if (mark) {
          dailyTotals[d].total++;
          if (mark.status === "present") dailyTotals[d].present++;
          else if (mark.status === "absent") dailyTotals[d].absent++;
          else if (mark.status === "late") dailyTotals[d].late++;
          else if (mark.status === "excused") dailyTotals[d].excused++;
        }
      }
    }

    return { dateColumns: sortedDates, matrixRows: rows, dailyTotals };
  }, [visibleRows, sortAsc]);

  async function assignExistingIds() {
    if (!window.confirm("যেসব Active Batch শিক্ষার্থীর স্থায়ী ID নেই, তাদের সবাইকে ID দিতে চান?"))
      return;
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
      setMessage(
        getApiErrorMessage(result.payload, "বর্তমান শিক্ষার্থীদের Student ID দেওয়া যায়নি।"),
      );
      setError(true);
    }
    setAssigningIds(false);
  }

  function exportCsv() {
    if (matrixRows.length === 0 || dateColumns.length === 0) {
      alert("Export করার মতো কোনো Attendance Data নেই।");
      return;
    }

    const headers = [
      "Student ID",
      "Student Name",
      "Batch",
      ...dateColumns.map((d) => formatDateHeader(d).top),
      "Present (P)",
      "Absent (A)",
      "Late (L)",
      "Excused (E)",
      "Total Classes",
      "Attendance Rate (%)",
    ];

    const csvLines = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",")];

    for (const row of matrixRows) {
      const dateValues = dateColumns.map((d) => {
        const mark = row.records[d];
        if (!mark) return "-";
        return mark.status === "present"
          ? "P"
          : mark.status === "absent"
            ? "A"
            : mark.status === "late"
              ? `L(${mark.minutesLate ?? 0}m)`
              : "E";
      });

      const line = [
        row.studentCode ?? "",
        row.studentName,
        row.batchName,
        ...dateValues,
        row.presentCount,
        row.absentCount,
        row.lateCount,
        row.excusedCount,
        row.totalMarked,
        `${row.rate}%`,
      ];
      csvLines.push(line.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","));
    }

    const blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const activeBatchName = data.batches.find((b) => b.id === batchId)?.name || "All_Batches";
    link.href = url;
    link.download = `attendance_sheet_${activeBatchName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section
      className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]"
      aria-labelledby="admin-attendance-title"
    >
      <header className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-accent-foreground">
              <Sheet className="size-4" /> Attendance Register
            </p>
            <h2 id="admin-attendance-title" className="mt-1 text-xl font-black text-primary">
              Google Sheet স্টাইল Attendance Sheet
            </h2>
            <p className="mt-1 text-xs text-muted">
              বামে Student ID ও শিক্ষার্থীর নাম, উপরে তারিখ অনুযায়ী স্বয়ংক্রিয় Attendance Matrix।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher */}
            <div className="inline-flex rounded-xl border border-border bg-secondary/50 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode("sheet")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                  viewMode === "sheet"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
                Sheet View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("log")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                  viewMode === "log"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted hover:text-foreground",
                )}
              >
                <List className="size-3.5" />
                Log View
              </button>
            </div>

            {/* Export Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportCsv}
              className="gap-1.5 font-bold"
              disabled={loading || matrixRows.length === 0}
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_180px_auto]">
          <label className="relative">
            <span className="sr-only">Attendance Search</span>
            <Search className="absolute left-3 top-3.5 size-4 text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Student ID বা শিক্ষার্থীর নাম লিখুন..."
            />
          </label>
          <select
            aria-label="Batch দিয়ে Filter করুন"
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
          >
            <option value="">সব Batch</option>
            {data.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <label className="relative">
            <span className="sr-only">তারিখ দিয়ে Filter করুন</span>
            <CalendarDays className="absolute left-3 top-3.5 size-4 text-muted" />
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="pl-9"
            />
          </label>
          {viewMode === "sheet" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSortAsc((v) => !v)}
              className="h-11 gap-1.5 px-3 text-xs font-bold"
              title="তারিখের ক্রম পরিবর্তন করুন"
            >
              <ArrowUpDown className="size-3.5" />
              {sortAsc ? "Oldest → Newest" : "Newest → Oldest"}
            </Button>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs">
          <span className="font-bold text-muted">সংকেত:</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="grid size-5 place-items-center rounded border border-emerald-300 bg-emerald-100 font-bold dark:border-emerald-800 dark:bg-emerald-950">
              P
            </span>
            উপস্থিত (Present)
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
            <span className="grid size-5 place-items-center rounded border border-rose-300 bg-rose-100 font-bold dark:border-rose-800 dark:bg-rose-950">
              A
            </span>
            অনুপস্থিত (Absent)
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
            <span className="grid size-5 place-items-center rounded border border-amber-300 bg-amber-100 font-bold dark:border-amber-800 dark:bg-amber-950">
              L
            </span>
            দেরিতে (Late)
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700 dark:text-sky-400">
            <span className="grid size-5 place-items-center rounded border border-sky-300 bg-sky-100 font-bold dark:border-sky-800 dark:bg-sky-950">
              E
            </span>
            ছুটি (Excused)
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="grid size-5 place-items-center rounded border border-border bg-secondary/50 font-medium">
              —
            </span>
            ক্লাস নেই
          </span>
          <span className="ml-auto font-bold text-primary">
            {matrixRows.length} জন শিক্ষার্থী • {dateColumns.length}টি ক্লাস তারিখ
          </span>
        </div>

        {data.missingStudentCodeCount > 0 && (
          <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-900">
            <span>
              {data.missingStudentCodeCount} জন বর্তমান শিক্ষার্থীর এখনো স্থায়ী ID নেই। নতুন Batch
              Enrollment-এ স্বয়ংক্রিয়ভাবে ID দেওয়া হয়।
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-3"
              disabled={assigningIds}
              onClick={() => void assignExistingIds()}
            >
              <RefreshCw className={cn("size-4", assigningIds && "animate-spin")} /> বর্তমান ID দিন
            </Button>
          </Alert>
        )}
        {data.truncated && (
          <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-900">
            শুধু সর্বশেষ ৫,০০০টি Attendance row দেখানো হচ্ছে। Register ছোট করতে Batch বা তারিখ দিয়ে
            Filter করুন।
          </Alert>
        )}
        {message && (
          <Alert variant={error ? "destructive" : "success"} className="mt-3">
            {message}
          </Alert>
        )}
      </header>

      {/* VIEW 1: GOOGLE SHEET MATRIX VIEW */}
      {viewMode === "sheet" && (
        <div className="relative max-h-[640px] overflow-auto border-t border-border">
          <table className="w-full border-collapse text-left text-sm">
            {/* Sheet Header */}
            <thead className="sticky top-0 z-20 bg-slate-100 text-xs font-bold text-slate-700 shadow-xs dark:bg-slate-900 dark:text-slate-200">
              <tr>
                <th className="sticky left-0 z-30 w-12 border-b border-r border-slate-300 bg-slate-100 px-3 py-2.5 text-center dark:border-slate-700 dark:bg-slate-900">
                  #
                </th>
                <th className="sticky left-12 z-30 min-w-[110px] border-b border-r border-slate-300 bg-slate-100 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                  Student ID
                </th>
                <th className="sticky left-[158px] z-30 min-w-[160px] border-b border-r-2 border-slate-300 border-r-slate-400 bg-slate-100 px-3 py-2.5 dark:border-slate-700 dark:border-r-slate-600 dark:bg-slate-900">
                  শিক্ষার্থীর নাম
                </th>
                {dateColumns.map((dateKey) => {
                  const { top, day } = formatDateHeader(dateKey);
                  return (
                    <th
                      key={dateKey}
                      className="min-w-[70px] border-b border-r border-slate-300 px-2 py-2 text-center text-xs dark:border-slate-700"
                    >
                      <div className="font-mono font-bold leading-none">{top}</div>
                      {day && <div className="mt-0.5 text-[10px] font-normal text-muted">{day}</div>}
                    </th>
                  );
                })}
                <th className="sticky right-[120px] z-30 w-24 border-b border-l-2 border-r border-slate-300 border-l-slate-400 bg-slate-100 px-2.5 py-2.5 text-center dark:border-slate-700 dark:border-l-slate-600 dark:bg-slate-900">
                  P / Total
                </th>
                <th className="sticky right-0 z-30 w-24 border-b border-r border-slate-300 bg-slate-100 px-2.5 py-2.5 text-center dark:border-slate-700 dark:bg-slate-900">
                  উপস্থিতি %
                </th>
              </tr>
            </thead>

            {/* Sheet Body */}
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index}>
                    <td colSpan={dateColumns.length + 5} className="border-b border-border p-3">
                      <div className="h-6 animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : matrixRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={dateColumns.length + 5}
                    className="p-12 text-center text-base text-muted"
                  >
                    এই Filter-এ কোনো Attendance Data পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                matrixRows.map((student, idx) => (
                  <tr
                    key={student.studentId}
                    className="transition hover:bg-sky-50/70 dark:hover:bg-slate-800/60"
                  >
                    {/* Index */}
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-card px-2 py-2 text-center text-xs text-muted dark:border-slate-800">
                      {idx + 1}
                    </td>

                    {/* Student ID */}
                    <td className="sticky left-12 z-10 border-b border-r border-slate-200 bg-card px-3 py-2 font-mono text-xs font-bold text-primary dark:border-slate-800">
                      {student.studentCode || "—"}
                    </td>

                    {/* Student Name */}
                    <td className="sticky left-[158px] z-10 border-b border-r-2 border-slate-200 border-r-slate-400 bg-card px-3 py-2 font-semibold text-foreground whitespace-nowrap dark:border-slate-800 dark:border-r-slate-600">
                      {student.studentName}
                    </td>

                    {/* Matrix Cells per Date */}
                    {dateColumns.map((dateKey) => {
                      const record = student.records[dateKey];
                      if (!record) {
                        return (
                          <td
                            key={dateKey}
                            className="border-b border-r border-slate-200 px-1 py-1 text-center text-xs text-slate-300 dark:border-slate-800 dark:text-slate-700"
                          >
                            —
                          </td>
                        );
                      }

                      const badgeClass = statusBadgeClasses[record.status];
                      const letter =
                        record.status === "present"
                          ? "P"
                          : record.status === "absent"
                            ? "A"
                            : record.status === "late"
                              ? "L"
                              : "E";

                      return (
                        <td
                          key={dateKey}
                          className="border-b border-r border-slate-200 p-1 text-center align-middle dark:border-slate-800"
                          title={`${student.studentName} - ${formatDateHeader(dateKey).top}: ${statusLabel[record.status]}${record.minutesLate ? ` (${record.minutesLate}m late)` : ""}`}
                        >
                          <span
                            className={cn(
                              "inline-grid size-7 place-items-center rounded border text-xs font-black shadow-2xs",
                              badgeClass,
                            )}
                          >
                            {letter}
                          </span>
                        </td>
                      );
                    })}

                    {/* Present / Total */}
                    <td className="sticky right-[120px] z-10 border-b border-l-2 border-r border-slate-200 border-l-slate-400 bg-card px-2.5 py-2 text-center text-xs font-bold tabular-nums dark:border-slate-800 dark:border-l-slate-600">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {student.presentCount + student.lateCount}
                      </span>{" "}
                      / <span className="text-muted">{student.totalMarked}</span>
                    </td>

                    {/* Percentage Rate Badge */}
                    <td className="sticky right-0 z-10 border-b border-r border-slate-200 bg-card px-2 py-2 text-center dark:border-slate-800">
                      <span
                        className={cn(
                          "inline-block rounded-md px-2 py-0.5 text-xs font-black tabular-nums",
                          student.rate >= 80
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : student.rate >= 60
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
                        )}
                      >
                        {student.rate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Sheet Footer Summary Row */}
            {matrixRows.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-slate-100 text-xs font-black text-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100">
                <tr>
                  <td
                    colSpan={3}
                    className="sticky left-0 z-30 border-t-2 border-r-2 border-slate-300 border-r-slate-400 bg-slate-100 px-4 py-3 text-right uppercase tracking-wider dark:border-slate-700 dark:border-r-slate-600 dark:bg-slate-900"
                  >
                    দৈনিক মোট উপস্থিতি (Present/Total):
                  </td>
                  {dateColumns.map((dateKey) => {
                    const totals = dailyTotals[dateKey];
                    const presentTotal = (totals?.present ?? 0) + (totals?.late ?? 0);
                    const totalStudents = totals?.total ?? 0;
                    return (
                      <td
                        key={dateKey}
                        className="border-t-2 border-r border-slate-300 px-1 py-2 text-center tabular-nums dark:border-slate-700"
                      >
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          {presentTotal}
                        </span>
                        <span className="text-[10px] text-muted">/{totalStudents}</span>
                      </td>
                    );
                  })}
                  <td
                    colSpan={2}
                    className="sticky right-0 z-30 border-t-2 border-l-2 border-slate-300 border-l-slate-400 bg-slate-100 px-3 py-3 text-center dark:border-slate-700 dark:border-l-slate-600 dark:bg-slate-900"
                  >
                    সার্বিক উপস্থিতি
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* VIEW 2: CLASSIC LOG LIST VIEW */}
      {viewMode === "log" && (
        <div className="max-h-[620px] overflow-auto border-t border-border">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-12 border-b border-r border-border px-3 py-2 text-center">#</th>
                <th className="border-b border-r border-border px-3 py-2">Student ID</th>
                <th className="border-b border-r border-border px-3 py-2">শিক্ষার্থীর নাম</th>
                <th className="border-b border-r border-border px-3 py-2">তারিখ</th>
                <th className="border-b border-r border-border px-3 py-2">Attendance Status</th>
                <th className="border-b border-r border-border px-3 py-2">Batch</th>
                <th className="border-b border-border px-3 py-2">Class / বিষয়</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index}>
                    <td colSpan={7} className="border-b border-border p-3">
                      <div className="h-5 animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted">
                    এই Filter-এ Submit করা কোনো Attendance পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, index) => (
                  <tr key={row.id} className="even:bg-secondary/20 hover:bg-sky-50/60">
                    <td className="border-b border-r border-border px-3 py-2 text-center text-xs text-muted">
                      {index + 1}
                    </td>
                    <td className="border-b border-r border-border px-3 py-2 font-mono font-bold text-primary">
                      {row.studentCode ?? "Unassigned"}
                    </td>
                    <td className="border-b border-r border-border px-3 py-2 font-semibold">
                      {row.studentName}
                    </td>
                    <td className="border-b border-r border-border px-3 py-2 tabular-nums">
                      {new Date(row.date).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Dhaka",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="border-b border-r border-border px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-1 text-xs font-black",
                          row.status === "present"
                            ? "bg-emerald-100 text-emerald-700"
                            : row.status === "absent"
                              ? "bg-red-100 text-red-700"
                              : row.status === "late"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-sky-100 text-sky-700",
                        )}
                      >
                        {statusLabel[row.status]}
                        {row.status === "late" && row.minutesLate
                          ? ` (${row.minutesLate}m)`
                          : ""}
                      </span>
                    </td>
                    <td className="border-b border-r border-border px-3 py-2">{row.batchName}</td>
                    <td className="border-b border-border px-3 py-2">{row.subjectName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
