"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Layers3, Pencil, Plus, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type BatchStatus = "planned" | "active" | "closed" | "archived";
type Batch = { id: string; organizationId: string; branchId: string; academicSessionId: string; code: string; name: string; studentClass: string; capacity: number; activeEnrollmentCount: number; startsAt: string; endsAt: string; status: BatchStatus };
type Context = {
  organizations: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; organizationId: string; name: string; code: string }>;
  academicSessions: Array<{ id: string; organizationId: string; name: string; startsAt: string; endsAt: string; status: string }>;
};

const fieldClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";
const statusLabel: Record<BatchStatus, string> = { planned: "পরিকল্পিত", active: "সক্রিয়", closed: "বন্ধ", archived: "আর্কাইভ" };
const initialForm = { organizationId: "", branchId: "", academicSessionId: "", code: "", name: "", studentClass: "class-11", capacity: 50, startsAt: "", endsAt: "" };

export function AdminBatchManager() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [context, setContext] = useState<Context>({ organizations: [], branches: [], academicSessions: [] });
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState<Batch>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<{ batches: Batch[]; context: Context }>("/api/batches?status=all&includeContext=true&limit=100");
    if (result.ok && isApiSuccess(result.payload)) {
      setBatches(result.payload.data.batches); setContext(result.payload.data.context);
      const firstOrganization = result.payload.data.context.organizations[0]?.id || "";
      const firstBranch = result.payload.data.context.branches.find((item) => item.organizationId === firstOrganization)?.id || "";
      const firstSession = result.payload.data.context.academicSessions.find((item) => item.organizationId === firstOrganization);
      setForm((current) => current.organizationId ? current : { ...current, organizationId: firstOrganization, branchId: firstBranch, academicSessionId: firstSession?.id || "", startsAt: firstSession?.startsAt.slice(0, 10) || "", endsAt: firstSession?.endsAt.slice(0, 10) || "" });
    }
    setLoading(false);
  }, []);
  useEffect(() => { const task = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(task); }, [load]);

  const branches = useMemo(() => context.branches.filter((item) => item.organizationId === form.organizationId), [context.branches, form.organizationId]);
  const sessions = useMemo(() => context.academicSessions.filter((item) => item.organizationId === form.organizationId), [context.academicSessions, form.organizationId]);

  function startCreate() { setEditing(undefined); setOpen(true); setForm((current) => ({ ...initialForm, organizationId: current.organizationId, branchId: current.branchId, academicSessionId: current.academicSessionId, startsAt: current.startsAt, endsAt: current.endsAt })); }
  function startEdit(batch: Batch) { setEditing(batch); setOpen(true); setForm({ organizationId: batch.organizationId, branchId: batch.branchId, academicSessionId: batch.academicSessionId, code: batch.code, name: batch.name, studentClass: batch.studentClass, capacity: batch.capacity, startsAt: batch.startsAt.slice(0, 10), endsAt: batch.endsAt.slice(0, 10) }); }
  function closeForm() { setOpen(false); setEditing(undefined); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const body = editing
      ? { batchId: editing.id, code: form.code, name: form.name, capacity: form.capacity, startsAt: new Date(`${form.startsAt}T00:00:00+06:00`).toISOString(), endsAt: new Date(`${form.endsAt}T23:59:59+06:00`).toISOString(), reason: "অ্যাডমিন কর্তৃক ব্যাচের তথ্য হালনাগাদ" }
      : { ...form, startsAt: new Date(`${form.startsAt}T00:00:00+06:00`).toISOString(), endsAt: new Date(`${form.endsAt}T23:59:59+06:00`).toISOString(), reason: "অ্যাডমিন কর্তৃক নতুন ব্যাচ তৈরি" };
    const result = await apiFetch("/api/batches", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "ব্যাচ সংরক্ষণ করা যায়নি।")); }
    else { setError(false); setMessage(editing ? "ব্যাচের তথ্য আপডেট হয়েছে।" : "নতুন ব্যাচ তৈরি হয়েছে। এখন বিষয় ও fee configure করুন।"); closeForm(); await load(); }
    setSaving(false);
  }

  async function changeStatus(batch: Batch, status: BatchStatus) {
    const action = status === "active" ? "সক্রিয়" : status === "closed" ? "বন্ধ" : "আর্কাইভ";
    if (!window.confirm(`${batch.name} ব্যাচটি ${action} করবেন?`)) return;
    setSaving(true); setMessage("");
    const result = await apiFetch("/api/batches", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: batch.id, status, reason: `অ্যাডমিন কর্তৃক ব্যাচ ${action}` }) });
    if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "ব্যাচের অবস্থা পরিবর্তন করা যায়নি।")); }
    else { setError(false); setMessage(`ব্যাচটি ${action} হয়েছে।`); await load(); }
    setSaving(false);
  }

  return <section className="space-y-5" aria-labelledby="batch-management-title"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">Batch operations</p><h2 id="batch-management-title" className="mt-1 text-2xl font-black text-primary">ব্যাচ তৈরি ও ব্যবস্থাপনা</h2><p className="mt-1 text-sm text-muted">নতুন batch তৈরি করুন, capacity ও সময়সীমা পরিবর্তন করুন এবং lifecycle নিয়ন্ত্রণ করুন।</p></div><Button onClick={startCreate}><Plus className="size-4" /> নতুন ব্যাচ</Button></div>{message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}{open && <form onSubmit={save} className="rounded-3xl border border-primary/30 bg-card p-5 shadow-[var(--shadow-md)]"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-accent-foreground">{editing ? "Edit batch" : "Create batch"}</p><h3 className="mt-1 text-xl font-black text-primary">{editing ? editing.name : "নতুন ব্যাচ"}</h3></div><button type="button" aria-label="ফর্ম বন্ধ করুন" onClick={closeForm}><X className="size-5 text-muted" /></button></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><div className="space-y-2"><Label htmlFor="batch-org">প্রতিষ্ঠান</Label><select id="batch-org" className={fieldClass} disabled={Boolean(editing)} value={form.organizationId} onChange={(event) => { const organizationId = event.target.value; const branchId = context.branches.find((item) => item.organizationId === organizationId)?.id || ""; const session = context.academicSessions.find((item) => item.organizationId === organizationId); setForm((current) => ({ ...current, organizationId, branchId, academicSessionId: session?.id || "", startsAt: session?.startsAt.slice(0, 10) || "", endsAt: session?.endsAt.slice(0, 10) || "" })); }}>{context.organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="batch-branch">শাখা</Label><select id="batch-branch" className={fieldClass} disabled={Boolean(editing)} value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="batch-session">Academic session</Label><select id="batch-session" className={fieldClass} disabled={Boolean(editing)} value={form.academicSessionId} onChange={(event) => { const session = sessions.find((item) => item.id === event.target.value); setForm((current) => ({ ...current, academicSessionId: event.target.value, startsAt: session?.startsAt.slice(0, 10) || current.startsAt, endsAt: session?.endsAt.slice(0, 10) || current.endsAt })); }}>{sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="batch-code">Batch code</Label><Input id="batch-code" required value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="HSC-2029-A" /></div><div className="space-y-2"><Label htmlFor="batch-name">Batch name</Label><Input id="batch-name" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="HSC 2029" /></div><div className="space-y-2"><Label htmlFor="batch-class">শ্রেণি</Label><select id="batch-class" className={fieldClass} disabled={Boolean(editing)} value={form.studentClass} onChange={(event) => setForm((current) => ({ ...current, studentClass: event.target.value }))}><option value="class-9">নবম</option><option value="class-10">দশম</option><option value="class-11">একাদশ</option><option value="class-12">দ্বাদশ</option></select></div><div className="space-y-2"><Label htmlFor="batch-capacity">Capacity</Label><Input id="batch-capacity" type="number" min={1} max={500} required value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: Number(event.target.value) }))} /></div><div className="space-y-2"><Label htmlFor="batch-start">শুরুর তারিখ</Label><Input id="batch-start" type="date" required value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="batch-end">শেষ তারিখ</Label><Input id="batch-end" type="date" required value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></div></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeForm}>বাতিল</Button><Button type="submit" disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে…" : "ব্যাচ সংরক্ষণ করুন"}</Button></div></form>}{loading ? <div className="h-40 animate-pulse rounded-3xl bg-secondary" /> : batches.length === 0 ? <div className="rounded-3xl border border-dashed border-border p-8 text-center text-muted">কোনো ব্যাচ নেই।</div> : <div className="grid gap-3 md:grid-cols-2">{batches.map((batch) => <article key={batch.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Layers3 className="size-5" /></span><div><h3 className="font-black text-primary">{batch.name}</h3><p className="text-xs text-muted">{batch.code} • {batch.activeEnrollmentCount}/{batch.capacity} শিক্ষার্থী</p></div></div><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", batch.status === "active" ? "bg-emerald-100 text-emerald-700" : batch.status === "planned" ? "bg-sky-100 text-sky-700" : "bg-secondary text-muted")}>{statusLabel[batch.status]}</span></div><p className="mt-3 text-xs text-muted">{new Date(batch.startsAt).toLocaleDateString("bn-BD")} – {new Date(batch.endsAt).toLocaleDateString("bn-BD")}</p><div className="mt-4 flex flex-wrap gap-2">{(batch.status === "planned" || batch.status === "active") && <Button size="sm" variant="outline" onClick={() => startEdit(batch)}><Pencil className="size-4" /> সম্পাদনা</Button>}{batch.status === "planned" && <Button size="sm" onClick={() => void changeStatus(batch, "active")} disabled={saving}><CheckCircle2 className="size-4" /> সক্রিয় করুন</Button>}{batch.status === "active" && <Button size="sm" variant="outline" onClick={() => void changeStatus(batch, "closed")} disabled={saving}>বন্ধ করুন</Button>}{(batch.status === "planned" || batch.status === "closed") && <Button size="sm" variant="outline" onClick={() => void changeStatus(batch, "archived")} disabled={saving}><Archive className="size-4" /> আর্কাইভ</Button>}</div></article>)}</div>}</section>;
}
