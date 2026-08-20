"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Building2, CheckCircle2, CircleDollarSign, Search, TrendingUp, UserRoundCheck, UsersRound, WalletCards, XCircle, Zap } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type FinanceRecord = {
  user: { id: string; name: string; reference?: string; phone?: string; email?: string; role: "student" | "teacher"; studentClass?: string; isActive: boolean };
  profile: { subjects: string[]; defaultAmountTk: number; configured: boolean };
  payment: { amountTk: number; status: "due" | "clear"; clearedAt?: string; note?: string; saved: boolean };
};
type FinanceData = {
  month: string;
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
  const [role, setRole] = useState<"all" | "student" | "teacher">("all");
  const [query, setQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string; reference?: string; phone?: string; studentClass?: string }>>([]);
  const [selected, setSelected] = useState<FinanceRecord>();
  const [defaultAmount, setDefaultAmount] = useState(0);
  const [monthAmount, setMonthAmount] = useState(0);
  const [subjects, setSubjects] = useState("");
  const [note, setNote] = useState("");
  const [expenseDrafts, setExpenseDrafts] = useState<Record<ExpenseCategory, ExpenseDraft>>({
    "room-rent": { amountTk: 0, status: "due", note: "" },
    electricity: { amountTk: 0, status: "due", note: "" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<FinanceData>(`/api/admin/finance?month=${month}&role=${role}&q=${encodeURIComponent(query)}`);
    if (result.ok && isApiSuccess(result.payload)) {
      setData(result.payload.data);
      setExpenseDrafts(Object.fromEntries(result.payload.data.expenses.map((expense) => [expense.category, { amountTk: expense.amountTk, status: expense.status, note: expense.note || "" }])) as Record<ExpenseCategory, ExpenseDraft>);
      setHasError(false);
    }
    else { setHasError(true); setMessage(getApiErrorMessage(result.payload, "আর্থিক তথ্য লোড করা যায়নি।")); }
    setLoading(false);
  }, [month, query, role]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 250); return () => window.clearTimeout(timer); }, [load]);

  useEffect(() => {
    if (!candidateQuery.trim()) return;
    const timer = window.setTimeout(async () => {
      const result = await apiFetch<{ users: Array<{ id: string; name: string; reference?: string; phone?: string; studentClass?: string }> }>(`/api/admin/finance?mode=candidates&role=student&q=${encodeURIComponent(candidateQuery)}`);
      if (result.ok && isApiSuccess(result.payload)) setCandidates(result.payload.data.users);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [candidateQuery]);

  function choose(record: FinanceRecord) {
    setSelected(record); setDefaultAmount(record.profile.defaultAmountTk); setMonthAmount(record.payment.amountTk); setSubjects(record.profile.subjects.join(", ")); setNote(record.payment.note || ""); setMessage("");
  }

  async function save(body: Record<string, unknown>, successText: string) {
    setSaving(true);
    const result = await apiFetch("/api/admin/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!result.ok || !isApiSuccess(result.payload)) { setHasError(true); setMessage(getApiErrorMessage(result.payload, "পরিবর্তন সংরক্ষণ করা যায়নি।")); }
    else { setHasError(false); setMessage(successText); await load(); }
    setSaving(false);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    await save({ action: "set-profile", userId: selected.user.id, defaultAmountTk: defaultAmount, subjects: selected.user.role === "student" ? subjects.split(",").map((item) => item.trim()).filter(Boolean) : [] }, "ডিফল্ট মাসিক সেটিং সংরক্ষণ হয়েছে। নতুন মাসে এই পরিমাণ স্বয়ংক্রিয়ভাবে আসবে।");
  }

  async function setMonth(status: string) {
    if (status !== "due" && status !== "clear") { setSelectedMonth(status); return; }
    if (!selected) return;
    await save({ action: "set-month", userId: selected.user.id, month, amountTk: monthAmount, status, note: note || undefined }, status === "clear" ? "এই মাসের পেমেন্ট ক্লিয়ার করা হয়েছে।" : "এই মাসের পেমেন্ট বাকি হিসেবে রাখা হয়েছে।");
  }

  async function setMembership(userId: string, included: boolean) {
    await save({ action: "set-membership", userId, included }, included ? "শিক্ষার্থীকে ABSP ফাইন্যান্সে যুক্ত করা হয়েছে।" : "সদস্যকে ABSP ফাইন্যান্স থেকে বাদ দেওয়া হয়েছে।");
    setCandidates([]); setCandidateQuery(""); if (!included) setSelected(undefined);
  }

  function updateExpense(category: ExpenseCategory, values: Partial<ExpenseDraft>) {
    setExpenseDrafts((current) => ({ ...current, [category]: { ...current[category], ...values } }));
  }

  async function saveExpense(category: ExpenseCategory, status: "due" | "clear") {
    const draft = expenseDrafts[category];
    await save({ action: "set-expense", month, category, amountTk: draft.amountTk, status, note: draft.note || undefined }, status === "clear" ? "পরিচালন ব্যয় পরিশোধ হিসেবে সংরক্ষিত হয়েছে।" : "পরিচালন ব্যয় বাকি হিসেবে সংরক্ষিত হয়েছে।");
  }

  const records = data?.records ?? [];
  const monthLabel = useMemo(() => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("bn-BD", { month: "long", year: "numeric", timeZone: "UTC" }), [month]);

  return <div className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#0b2545,#123a6b_70%,#174d82)] p-6 text-white shadow-lg sm:p-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.22em] text-brand-yellow">Finance command center</p><h1 className="mt-2 text-3xl font-black">মাসিক পেমেন্ট ও আর্থিক হিসাব</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">শুধু ABSP-এর নিজস্ব শিক্ষার্থী ও শিক্ষকদের ফি, পেমেন্ট, ক্লিয়ারেন্স এবং নগদ প্রবাহ।</p></div><div><Label htmlFor="finance-month" className="text-xs text-white/70">হিসাবের মাস</Label><Input id="finance-month" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setSelected(undefined); setLoading(true); }} className="mt-1 border-white/20 bg-white text-primary" /></div></div></header>
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Label htmlFor="absp-student-search">ABSP শিক্ষার্থী যুক্ত করুন</Label><div className="relative mt-1.5"><Search className="absolute left-3 top-3 size-4 text-muted" /><Input id="absp-student-search" value={candidateQuery} onChange={(e) => setCandidateQuery(e.target.value)} className="pl-9" placeholder="নাম বা রেফারেন্স লিখুন" /></div></div>
        <p className="max-w-sm text-xs leading-5 text-muted">শুধু এখানে যুক্ত শিক্ষার্থী এবং শিক্ষক তালিকায় “ABSP শিক্ষক” হিসেবে চিহ্নিত শিক্ষকরা আর্থিক হিসাবে আসবেন।</p>
      </div>
      {candidateQuery.trim() && candidates.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{candidates.map((candidate) => <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div className="min-w-0"><p className="truncate text-sm font-black text-primary">{candidate.name}</p><p className="truncate text-xs text-muted">{candidate.reference ? `#${candidate.reference}` : candidate.phone || candidate.studentClass}</p></div><Button size="sm" onClick={() => void setMembership(candidate.id, true)} disabled={saving}>যুক্ত করুন</Button></div>)}</div>}
    </section>
    {message && <Alert variant={hasError ? "destructive" : "success"}>{message}</Alert>}
    {data && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><SummaryCard label="শিক্ষার্থী থেকে আদায়" value={data.summary.studentCollectedTk} hint={`${money(data.summary.studentDueTk)} বাকি • মোট ${money(data.summary.studentExpectedTk)}`} icon={CircleDollarSign} tone="bg-emerald-100 text-emerald-700" /><SummaryCard label="শিক্ষককে পরিশোধ" value={data.summary.teacherPaidTk} hint={`${money(data.summary.teacherDueTk)} বাকি • মোট ${money(data.summary.teacherPayrollTk)}`} icon={WalletCards} tone="bg-violet-100 text-violet-700" /><SummaryCard label="পরিচালন ব্যয়" value={data.summary.operatingPaidTk} hint={`${money(data.summary.operatingDueTk)} বাকি • মোট ${money(data.summary.operatingExpenseTk)}`} icon={Building2} tone="bg-orange-100 text-orange-700" /><SummaryCard label="বর্তমান নেট ক্যাশ" value={data.summary.netCashTk} hint="আদায় থেকে শিক্ষক ও পরিচালন ব্যয় বাদ দিয়ে" icon={TrendingUp} tone={data.summary.netCashTk >= 0 ? "bg-sky-100 text-sky-700" : "bg-red-100 text-red-700"} /><SummaryCard label="ক্লিয়ার রেকর্ড" value={data.summary.studentClearCount + data.summary.teacherClearCount} hint={`${data.summary.studentDueCount + data.summary.teacherDueCount}টি রেকর্ড এখনো বাকি`} icon={UserRoundCheck} tone="bg-amber-100 text-amber-700" /></section>}

    {data && <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4"><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Operating expenses</p><h2 className="mt-1 text-xl font-black text-primary">রুম ভাড়া ও বিদ্যুৎ বিল</h2><p className="mt-1 text-sm text-muted">প্রতি মাসের পরিমাণ ও পরিশোধের অবস্থা আলাদাভাবে রাখুন। পরিশোধিত ব্যয় নেট ক্যাশে স্বয়ংক্রিয়ভাবে হিসাব হবে।</p></div>
      <div className="grid gap-4 lg:grid-cols-2">{(["room-rent", "electricity"] as const).map((category) => {
        const draft = expenseDrafts[category];
        const isRent = category === "room-rent";
        const Icon = isRent ? Building2 : Zap;
        return <article key={category} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3"><span className={cn("grid size-10 place-items-center rounded-xl", isRent ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700")}><Icon className="size-5" /></span><div><h3 className="font-black text-primary">{isRent ? "রুম ভাড়া" : "বিদ্যুৎ বিল"}</h3><p className="text-xs text-muted">{monthLabel}</p></div><span className={cn("ml-auto rounded-full px-2.5 py-1 text-[11px] font-black", draft.status === "clear" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{draft.status === "clear" ? "ক্লিয়ার" : "বাকি"}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor={`${category}-amount`}>পরিমাণ (৳)</Label><Input id={`${category}-amount`} type="number" min={0} value={draft.amountTk} onChange={(event) => updateExpense(category, { amountTk: Number(event.target.value) })} /></div><div className="space-y-1.5"><Label htmlFor={`${category}-note`}>নোট (ঐচ্ছিক)</Label><Input id={`${category}-note`} value={draft.note} onChange={(event) => updateExpense(category, { note: event.target.value })} placeholder="রসিদ/মিটারের তথ্য" /></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => void saveExpense(category, "due")}><XCircle className="size-4" /> বাকি রাখুন</Button><Button type="button" disabled={saving} onClick={() => void saveExpense(category, "clear")}><CheckCircle2 className="size-4" /> ক্লিয়ার করুন</Button></div>
        </article>;
      })}</div>
    </section>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4"><div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted" /><Input value={query} onChange={(e) => { setQuery(e.target.value); setLoading(true); }} className="pl-9" placeholder="নাম, রেফারেন্স বা ফোন দিয়ে খুঁজুন" /></div><div className="flex rounded-xl bg-secondary p-1">{(["all", "student", "teacher"] as const).map((value) => <button key={value} onClick={() => { setRole(value); setSelected(undefined); setLoading(true); }} className={cn("rounded-lg px-3 py-2 text-xs font-black", role === value ? "bg-primary text-white shadow-sm" : "text-primary")}>{value === "all" ? "সবাই" : value === "student" ? "শিক্ষার্থী" : "শিক্ষক"}</button>)}</div></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">{monthLabel}</p><h2 className="mt-1 text-xl font-black text-primary">মাসিক লেজার</h2></div>
        {loading ? <div className="h-72 animate-pulse rounded-3xl bg-secondary" /> : records.length === 0 ? <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted">কোনো রেকর্ড পাওয়া যায়নি।</div> : <div className="space-y-2">{records.map((record) => <button key={record.user.id} onClick={() => choose(record)} className={cn("grid w-full gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 sm:grid-cols-[1fr_auto_auto] sm:items-center", selected?.user.id === record.user.id ? "border-primary ring-2 ring-primary/10" : "border-border")}><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-black text-primary">{record.user.name}</p><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", record.user.role === "student" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700")}>{record.user.role === "student" ? "শিক্ষার্থী" : "শিক্ষক"}</span></div><p className="mt-1 truncate text-xs text-muted">{record.user.reference ? `#${record.user.reference} • ` : ""}{record.user.phone || record.user.email || "যোগাযোগ নেই"}</p>{record.user.role === "student" && <p className="mt-1 truncate text-xs text-muted">{record.profile.subjects.join(" • ") || "কোনো বিষয় নেই"}</p>}</div><div className="sm:text-right"><p className="font-black text-primary">{money(record.payment.amountTk)}</p><p className="text-[10px] text-muted">ডিফল্ট {money(record.profile.defaultAmountTk)}</p></div><span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black", record.payment.status === "clear" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{record.payment.status === "clear" ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}{record.payment.status === "clear" ? "ক্লিয়ার" : "বাকি"}</span></button>)}</div>}
      </section>

      <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-md)] xl:sticky xl:top-24">{!selected ? <div className="grid min-h-72 place-items-center text-center"><div><UsersRound className="mx-auto size-10 text-muted" /><p className="mt-3 font-black text-primary">একটি রেকর্ড নির্বাচন করুন</p><p className="mt-1 text-sm leading-6 text-muted">ডিফল্ট পরিমাণ বা এই মাসের ক্লিয়ারেন্স পরিবর্তন করতে বাম পাশ থেকে কাউকে বেছে নিন।</p></div></div> : <div className="space-y-5"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Payment settings</p><h2 className="mt-1 text-xl font-black text-primary">{selected.user.name}</h2><p className="text-xs text-muted">{selected.user.role === "student" ? "শিক্ষার্থী ফি" : "শিক্ষক পেমেন্ট"}</p></div><form onSubmit={saveProfile} className="space-y-3 rounded-2xl bg-secondary/45 p-4"><h3 className="text-sm font-black text-primary">ডিফল্ট মাসিক সেটিং</h3>{selected.user.role === "student" && <div className="space-y-1.5"><Label htmlFor="subjects">বিষয়সমূহ</Label><Input id="subjects" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="কমা দিয়ে বিষয় লিখুন" /><p className="text-[10px] text-muted">যেমন: পদার্থবিজ্ঞান, রসায়ন</p></div>}<div className="space-y-1.5"><Label htmlFor="default-amount">ডিফল্ট পরিমাণ (৳)</Label><Input id="default-amount" type="number" min={0} required value={defaultAmount} onChange={(e) => setDefaultAmount(Number(e.target.value))} /></div><Button type="submit" variant="outline" className="w-full" disabled={saving}>ডিফল্ট সংরক্ষণ</Button></form><div className="space-y-3 border-t border-border pt-5"><div><h3 className="text-sm font-black text-primary">{monthLabel}</h3><p className="text-xs text-muted">এই পরিবর্তন শুধু নির্বাচিত মাসে প্রযোজ্য</p></div><div className="space-y-1.5"><Label htmlFor="month-amount">এই মাসের পরিমাণ (৳)</Label><Input id="month-amount" type="number" min={0} required value={monthAmount} onChange={(e) => setMonthAmount(Number(e.target.value))} /></div><div className="space-y-1.5"><Label htmlFor="payment-note">নোট (ঐচ্ছিক)</Label><Input id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="রসিদ/সমন্বয়ের তথ্য" /></div><div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => void setMonth("due")}><XCircle className="size-4" /> বাকি রাখুন</Button><Button type="button" disabled={saving} onClick={() => void setMonth("clear")}><CheckCircle2 className="size-4" /> ক্লিয়ার করুন</Button></div></div></div>}</aside>
    </div>
  </div>;
}
