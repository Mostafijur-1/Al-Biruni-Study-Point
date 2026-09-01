"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Building2, CheckCircle2, ChevronDown, CircleDollarSign, Search, TrendingUp, UserRoundCheck, UsersRound, WalletCards, XCircle, Zap } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type FinanceRecord = {
  user: { id: string; name: string; studentCode?: string; reference?: string; phone?: string; email?: string; role: "student" | "teacher"; studentClass?: string; isActive: boolean; batch?: { id: string; name?: string } };
  profile: { subjects: string[]; defaultAmountTk: number; configured: boolean };
  payment: { amountTk: number; paidTk?: number; balanceTk?: number; status: "due" | "partial" | "clear" | "overpaid"; clearedAt?: string; note?: string; saved: boolean };
};
type FinanceData = {
  month: string;
  ledgerMode: "legacy" | "shadow" | "authoritative";
  batches: Array<{ id: string; name: string; status: string }>;
  records: FinanceRecord[];
  expenses: Array<{ category: ExpenseCategory; amountTk: number; status: "due" | "clear"; clearedAt?: string; note?: string; saved: boolean }>;
  summary: { studentExpectedTk: number; studentCollectedTk: number; studentDueTk: number; teacherPayrollTk: number; teacherPaidTk: number; teacherDueTk: number; operatingExpenseTk: number; operatingPaidTk: number; operatingDueTk: number; netCashTk: number; studentClearCount: number; studentDueCount: number; teacherClearCount: number; teacherDueCount: number };
};

type ExpenseCategory = "room-rent" | "electricity";
type ExpenseDraft = { amountTk: number; status: "due" | "clear"; note: string };

const monthNow = new Date().toISOString().slice(0, 7);
const money = (value: number) => `${value.toLocaleString("bn-BD")} ৳`;

function SummaryCard({ label, value, hint, icon: Icon, tone }: { label: string; value: number; hint: string; icon: typeof Banknote; tone: string }) {
  return <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><span className={cn("grid size-10 place-items-center rounded-xl", tone)}><Icon className="size-5" /></span><p className="text-2xl font-black text-primary">{money(value)}</p></div><p className="mt-3 text-sm font-black text-primary">{label}</p><p className="mt-1 text-xs text-muted">{hint}</p></article>;
}

export function FinanceWorkspace() {
  const [data, setData] = useState<FinanceData>();
  const [month, setSelectedMonth] = useState(monthNow);
  const [role, setRole] = useState<"all" | "student" | "teacher">("student");
  const [query, setQuery] = useState("");
  const [batchId, setBatchId] = useState("");
  const [selected, setSelected] = useState<FinanceRecord>();
  const [defaultAmount, setDefaultAmount] = useState(0);
  const [monthAmount, setMonthAmount] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [note, setNote] = useState("");
  const [expandedExpense, setExpandedExpense] = useState<ExpenseCategory>();
  const [expenseDrafts, setExpenseDrafts] = useState<Record<ExpenseCategory, ExpenseDraft>>({
    "room-rent": { amountTk: 0, status: "due", note: "" },
    electricity: { amountTk: 0, status: "due", note: "" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ month, role });
    if (batchId) params.set("batchId", batchId);
    if (query.trim()) params.set("q", query.trim());
    const result = await apiFetch<FinanceData>(`/api/admin/finance?${params.toString()}`);
    if (result.ok && isApiSuccess(result.payload)) {
      setData(result.payload.data);
      setExpenseDrafts(Object.fromEntries(result.payload.data.expenses.map((expense) => [expense.category, { amountTk: expense.amountTk, status: expense.status, note: expense.note || "" }])) as Record<ExpenseCategory, ExpenseDraft>);
      setHasError(false);
    }
    else { setHasError(true); setMessage(getApiErrorMessage(result.payload, "আর্থিক তথ্য লোড করা যায়নি।")); }
    setLoading(false);
  }, [batchId, month, query, role]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 250); return () => window.clearTimeout(timer); }, [load]);

  function choose(record: FinanceRecord) {
    setSelected(record); setDefaultAmount(record.profile.defaultAmountTk); setMonthAmount(record.payment.amountTk); setCashAmount(Math.max(0, record.payment.balanceTk ?? record.payment.amountTk)); setNote(record.payment.note || ""); setMessage("");
  }

  async function save(body: Record<string, unknown>, successText: string) {
    setSaving(true);
    const result = await apiFetch("/api/admin/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!result.ok || !isApiSuccess(result.payload)) { setHasError(true); setMessage(getApiErrorMessage(result.payload, "পরিবর্তন Save করা যায়নি।")); }
    else { setHasError(false); setMessage(successText); await load(); }
    setSaving(false);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    await save(data?.ledgerMode === "authoritative" && selected.user.role === "student"
      ? { action: "assign-fee-plan", idempotencyKey: crypto.randomUUID(), studentId: selected.user.id, code: `MONTHLY-${selected.user.id}`, name: "Monthly student fee", amountTk: defaultAmount, effectiveFrom: month }
      : { action: "set-profile", userId: selected.user.id, defaultAmountTk: defaultAmount }, "Default মাসিক Setting Save হয়েছে। নতুন মাসে এই পরিমাণ স্বয়ংক্রিয়ভাবে আসবে।");
  }

  async function setMonth(status: string) {
    if (status !== "due" && status !== "clear") { setSelectedMonth(status); return; }
    if (!selected) return;
    if (data?.ledgerMode === "authoritative") {
      const kind = selected.user.role === "student" ? "student-fee" : "teacher-payroll";
      const direction = selected.user.role === "student" ? "in" : "out";
      const common = { idempotencyKey: crypto.randomUUID(), userId: selected.user.id, role: selected.user.role, kind, period: month, description: `${month} ${kind}`, issuedAt: new Date().toISOString() };
      if (status === "due") await save({ action: "issue-invoice", ...common, amountTk: monthAmount }, "এই মাসের অপরিবর্তনীয় ইনভয়েস সংরক্ষিত হয়েছে।");
      else await save({ action: "record-cash", ...common, invoiceAmountTk: monthAmount, direction, amountTk: cashAmount, allocationTk: Math.min(cashAmount, Math.max(0, selected.payment.balanceTk ?? monthAmount)), occurredAt: new Date().toISOString(), reference: note || undefined }, "নগদ লেনদেন ও রসিদ সংরক্ষিত হয়েছে।");
      return;
    }
    await save({ action: "set-month", userId: selected.user.id, month, amountTk: monthAmount, status, note: note || undefined }, status === "clear" ? "এই মাসের পেমেন্ট ক্লিয়ার করা হয়েছে।" : "এই মাসের পেমেন্ট বাকি হিসেবে রাখা হয়েছে।");
  }

  function updateExpense(category: ExpenseCategory, values: Partial<ExpenseDraft>) {
    setExpenseDrafts((current) => ({ ...current, [category]: { ...current[category], ...values } }));
  }

  async function saveExpense(category: ExpenseCategory, status: "due" | "clear") {
    const draft = expenseDrafts[category];
    if (data?.ledgerMode === "authoritative") {
      const userId = category === "room-rent" ? "000000000000000000000001" : "000000000000000000000002";
      const common = { idempotencyKey: crypto.randomUUID(), userId, role: "vendor", kind: "operating-expense", period: month, description: category === "room-rent" ? "Room rent" : "Electricity bill", expenseCategory: category, vendorName: category === "room-rent" ? "Landlord" : "Electricity provider", issuedAt: new Date().toISOString() };
      if (status === "due") await save({ action: "issue-invoice", ...common, amountTk: draft.amountTk }, "পরিচালন ব্যয়ের ইনভয়েস সংরক্ষিত হয়েছে।");
      else await save({ action: "record-cash", ...common, invoiceAmountTk: draft.amountTk, direction: "out", amountTk: draft.amountTk, allocationTk: draft.amountTk, occurredAt: new Date().toISOString(), note: draft.note || undefined }, "নগদ পরিচালন ব্যয় ও রসিদ সংরক্ষিত হয়েছে।");
      setExpandedExpense(undefined); return;
    }
    await save({ action: "set-expense", month, category, amountTk: draft.amountTk, status, note: draft.note || undefined }, status === "clear" ? "পরিচালন ব্যয় পরিশোধ হিসেবে সংরক্ষিত হয়েছে।" : "পরিচালন ব্যয় বাকি হিসেবে সংরক্ষিত হয়েছে।");
    setExpandedExpense(undefined);
  }

  const records = data?.records ?? [];
  const monthLabel = useMemo(() => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("bn-BD", { month: "long", year: "numeric", timeZone: "UTC" }), [month]);

  return <div className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#0b2545,#123a6b_70%,#174d82)] p-6 text-white shadow-lg sm:p-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.22em] text-brand-yellow">Finance command center</p><h1 className="mt-2 text-3xl font-black">মাসিক পেমেন্ট ও আর্থিক হিসাব</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">শুধু ABSP-এর নিজস্ব শিক্ষার্থী ও শিক্ষকদের ফি, পেমেন্ট, ক্লিয়ারেন্স এবং নগদ প্রবাহ।</p></div><div><Label htmlFor="finance-month" className="text-xs text-white/70">হিসাবের মাস</Label><Input id="finance-month" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setSelected(undefined); setLoading(true); }} className="mt-1 border-white/20 bg-white text-primary" /></div></div></header>
    {message && <Alert variant={hasError ? "destructive" : "success"}>{message}</Alert>}
    {data?.ledgerMode === "shadow" && <Alert>Immutable Cash Ledger এখন Shadow Mode-এ আছে। Migration Reconciliation Approve না হওয়া পর্যন্ত Monthly Tracker-ই মূল হিসাব হিসেবে থাকবে।</Alert>}
    {data?.ledgerMode === "authoritative" && <Alert variant="success">Cash Ledger এখন মূল হিসাব। প্রতিটি Cash Entry থেকে অপরিবর্তনীয় Transaction ও Receipt তৈরি হবে।</Alert>}
    {data && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><SummaryCard label="শিক্ষার্থী থেকে আদায়" value={data.summary.studentCollectedTk} hint={`${money(data.summary.studentDueTk)} বাকি • মোট ${money(data.summary.studentExpectedTk)}`} icon={CircleDollarSign} tone="bg-emerald-100 text-emerald-700" /><SummaryCard label="শিক্ষককে পরিশোধ" value={data.summary.teacherPaidTk} hint={`${money(data.summary.teacherDueTk)} বাকি • মোট ${money(data.summary.teacherPayrollTk)}`} icon={WalletCards} tone="bg-violet-100 text-violet-700" /><SummaryCard label="পরিচালন ব্যয়" value={data.summary.operatingPaidTk} hint={`${money(data.summary.operatingDueTk)} বাকি • মোট ${money(data.summary.operatingExpenseTk)}`} icon={Building2} tone="bg-orange-100 text-orange-700" /><SummaryCard label="বর্তমান নেট ক্যাশ" value={data.summary.netCashTk} hint="আদায় থেকে শিক্ষক ও পরিচালন ব্যয় বাদ দিয়ে" icon={TrendingUp} tone={data.summary.netCashTk >= 0 ? "bg-sky-100 text-sky-700" : "bg-red-100 text-red-700"} /><SummaryCard label="ক্লিয়ার রেকর্ড" value={data.summary.studentClearCount + data.summary.teacherClearCount} hint={`${data.summary.studentDueCount + data.summary.teacherDueCount}টি রেকর্ড এখনো বাকি`} icon={UserRoundCheck} tone="bg-amber-100 text-amber-700" /></section>}

    {data && <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3"><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Operating expenses</p><h2 className="mt-1 text-lg font-black text-primary">পরিচালন ব্যয়</h2></div>
      <div className="space-y-2">{(["room-rent", "electricity"] as const).map((category) => {
        const draft = expenseDrafts[category];
        const isRent = category === "room-rent";
        const Icon = isRent ? Building2 : Zap;
        const expanded = expandedExpense === category;
        return <article key={category} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <button type="button" aria-expanded={expanded} onClick={() => setExpandedExpense(expanded ? undefined : category)} className="flex w-full items-center gap-3 p-3 text-left sm:p-4"><span className={cn("grid size-9 place-items-center rounded-xl", isRent ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700")}><Icon className="size-4.5" /></span><div className="min-w-0"><h3 className="font-black text-primary">{isRent ? "রুম ভাড়া" : "বিদ্যুৎ বিল"}</h3><p className={cn("text-[11px] font-bold", draft.status === "clear" ? "text-emerald-700" : "text-red-700")}>{draft.status === "clear" ? "ক্লিয়ার" : "বাকি"}</p></div><p className="ml-auto text-lg font-black text-primary">{money(draft.amountTk)}</p><ChevronDown className={cn("size-4 text-muted transition-transform", expanded && "rotate-180")} /></button>
          {expanded && <div className="border-t border-border p-3 sm:p-4"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor={`${category}-amount`}>পরিমাণ (৳)</Label><Input id={`${category}-amount`} type="number" min={0} value={draft.amountTk} onChange={(event) => updateExpense(category, { amountTk: Number(event.target.value) })} /></div><div className="space-y-1.5"><Label htmlFor={`${category}-note`}>নোট (ঐচ্ছিক)</Label><Input id={`${category}-note`} value={draft.note} onChange={(event) => updateExpense(category, { note: event.target.value })} placeholder="রসিদ/মিটারের তথ্য" /></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => void saveExpense(category, "due")}><XCircle className="size-4" /> বাকি রাখুন</Button><Button type="button" disabled={saving} onClick={() => void saveExpense(category, "clear")}><CheckCircle2 className="size-4" /> ক্লিয়ার করুন</Button></div></div>}
        </article>;
      })}</div>
    </section>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4"><div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted" /><Input value={query} onChange={(e) => { setQuery(e.target.value); setLoading(true); }} className="pl-9" placeholder="ব্যাচের ভিতরে নাম বা রেফারেন্স দিয়ে খুঁজুন" /></div><select aria-label="ব্যাচ নির্বাচন" value={batchId} onChange={(event) => { setBatchId(event.target.value); setSelected(undefined); setLoading(true); }} disabled={role === "teacher"} className="h-11 rounded-xl border border-input bg-white px-3 text-sm"><option value="">সব ব্যাচ</option>{data?.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select><div className="flex rounded-xl bg-secondary p-1">{(["student", "teacher", "all"] as const).map((value) => <button key={value} onClick={() => { setRole(value); if (value === "teacher") setBatchId(""); setSelected(undefined); setLoading(true); }} className={cn("rounded-lg px-3 py-2 text-xs font-black", role === value ? "bg-primary text-white shadow-sm" : "text-primary")}>{value === "all" ? "সবাই" : value === "student" ? "শিক্ষার্থী" : "শিক্ষক"}</button>)}</div></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">{monthLabel}</p><h2 className="mt-1 text-xl font-black text-primary">মাসিক লেজার</h2></div>
        {loading ? <div className="h-72 animate-pulse rounded-3xl bg-secondary" /> : records.length === 0 ? <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted">এই ব্যাচে কোনো active শিক্ষার্থী পাওয়া যায়নি।</div> : <div className="space-y-2">{records.map((record) => <button key={record.user.id} onClick={() => choose(record)} className={cn("grid w-full gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 sm:grid-cols-[1fr_auto_auto] sm:items-center", selected?.user.id === record.user.id ? "border-primary ring-2 ring-primary/10" : "border-border")}><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-black text-primary">{record.user.name}</p><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", record.user.role === "student" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700")}>{record.user.role === "student" ? "শিক্ষার্থী" : "শিক্ষক"}</span></div><p className="mt-1 truncate text-xs text-muted">{record.user.role === "student" ? `ID ${record.user.studentCode ?? "Unassigned"} • ` : ""}{record.user.role === "student" && record.user.batch?.name ? `${record.user.batch.name} • ` : ""}{record.user.reference ? `#${record.user.reference} • ` : ""}{record.user.phone || record.user.email || "যোগাযোগ নেই"}</p>{record.user.role === "student" && <p className="mt-1 truncate text-xs text-muted">{record.profile.subjects.join(" • ") || "কোনো বিষয় নেই"}</p>}</div><div className="sm:text-right"><p className="font-black text-primary">{money(record.payment.amountTk)}</p>{data?.ledgerMode === "authoritative" ? <p className="text-[10px] text-muted">নগদ {money(record.payment.paidTk ?? 0)} • বাকি {money(record.payment.balanceTk ?? 0)}</p> : <p className="text-[10px] text-muted">ডিফল্ট {money(record.profile.defaultAmountTk)}</p>}</div><span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black", record.payment.status === "clear" ? "bg-emerald-100 text-emerald-700" : record.payment.status === "partial" ? "bg-amber-100 text-amber-800" : record.payment.status === "overpaid" ? "bg-sky-100 text-sky-700" : "bg-red-100 text-red-700")}>{record.payment.status === "clear" ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}{record.payment.status === "clear" ? "ক্লিয়ার" : record.payment.status === "partial" ? "আংশিক" : record.payment.status === "overpaid" ? "অগ্রিম" : "বাকি"}</span></button>)}</div>}
      </section>

      <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-md)] xl:sticky xl:top-24">{!selected ? <div className="grid min-h-72 place-items-center text-center"><div><UsersRound className="mx-auto size-10 text-muted" /><p className="mt-3 font-black text-primary">একটি Record Select করুন</p><p className="mt-1 text-sm leading-6 text-muted">Default Amount বা এই মাসের Payment Status পরিবর্তন করতে বাম পাশ থেকে কাউকে Select করুন।</p></div></div> : <div className="space-y-5"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Payment Setting</p><h2 className="mt-1 text-xl font-black text-primary">{selected.user.name}</h2><p className="text-xs text-muted">{selected.user.role === "student" ? `${selected.user.batch?.name || "Batch"} • শিক্ষার্থীর Fee` : "Teacher Payment"}</p></div><form onSubmit={saveProfile} className="space-y-3 rounded-2xl bg-secondary/45 p-4"><h3 className="text-sm font-black text-primary">Default মাসিক Setting</h3>{selected.user.role === "student" && <p className="text-xs text-muted">বিষয়: {selected.profile.subjects.join(" • ") || "Select করা নেই"}</p>}<div className="space-y-1.5"><Label htmlFor="default-amount">Default Amount (৳)</Label><Input id="default-amount" type="number" min={0} required value={defaultAmount} onChange={(e) => setDefaultAmount(Number(e.target.value))} /></div><Button type="submit" variant="outline" className="w-full" disabled={saving}>Default Save করুন</Button></form><div className="space-y-3 border-t border-border pt-5"><div><h3 className="text-sm font-black text-primary">{monthLabel}</h3><p className="text-xs text-muted">এই পরিবর্তন শুধু Select করা মাসে প্রযোজ্য</p></div><div className="space-y-1.5"><Label htmlFor="month-amount">এই মাসের Amount (৳)</Label><Input id="month-amount" type="number" min={0} required value={monthAmount} onChange={(e) => setMonthAmount(Number(e.target.value))} /></div><div className="space-y-1.5"><Label htmlFor="payment-note">Note (ঐচ্ছিক)</Label><Input id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="রসিদ বা সমন্বয়ের তথ্য" /></div><div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => void setMonth("due")}><XCircle className="size-4" /> বাকি রাখুন</Button><Button type="button" disabled={saving} onClick={() => void setMonth("clear")}><CheckCircle2 className="size-4" /> Clear করুন</Button></div></div></div>}</aside>
    </div>
  </div>;
}
