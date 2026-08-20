"use client";

import { useEffect, useState } from "react";
import { Check, Settings2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Batch = { id: string; name: string; status: string };
type Subject = { id: string; name: string; nameBn: string; code: string };
const selectClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary";

export function BatchSubjectSetupPanel() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [available, setAvailable] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    void Promise.all([
      apiFetch<{ batches: Batch[] }>("/api/batches?status=active&limit=100"),
      apiFetch<{ batches: Batch[] }>("/api/batches?status=planned&limit=100"),
    ]).then((results) => setBatches([...new Map(results.flatMap((result) => result.ok && isApiSuccess(result.payload) ? result.payload.data.batches : []).map((batch) => [batch.id, batch])).values()]));
  }, []);

  useEffect(() => {
    if (!batchId) return;
    void apiFetch<{ subjects: Subject[]; availableSubjects: Subject[] }>(`/api/coaching-subjects?batchId=${batchId}`).then((result) => {
      if (!result.ok || !isApiSuccess(result.payload)) return;
      setAvailable(result.payload.data.availableSubjects);
      setSelected(result.payload.data.subjects.map((subject) => subject.id));
    });
  }, [batchId]);

  async function save() {
    if (!batchId || selected.length === 0) return;
    setSaving(true); setMessage("");
    const result = await apiFetch("/api/coaching-subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, subjectIds: selected }) });
    if (!result.ok || !isApiSuccess(result.payload)) { setError(true); setMessage(getApiErrorMessage(result.payload, "Configuration সংরক্ষণ করা যায়নি।")); }
    else { setError(false); setMessage("ব্যাচের coaching subjects সংরক্ষণ হয়েছে। শিক্ষার্থীর fee Finance থেকে নির্ধারণ করুন।"); }
    setSaving(false);
  }

  return <div className="space-y-6"><header className="rounded-3xl bg-[linear-gradient(125deg,#0b2545,#123a6b_70%,#174d82)] p-6 text-white shadow-lg sm:p-8"><div className="flex items-center gap-3"><Settings2 className="size-8 text-brand-yellow" /><div><p className="text-xs font-black uppercase tracking-[.22em] text-brand-yellow">Academic setup</p><h1 className="mt-1 text-3xl font-black">ব্যাচের কোচিং বিষয়</h1></div></div><p className="mt-3 max-w-3xl text-sm text-white/75">প্রতিটি ব্যাচে কোন বিষয় পড়ানো হবে তা নির্বাচন করুন। ফি প্রতিটি শিক্ষার্থীর জন্য Finance থেকে আলাদাভাবে নির্ধারিত হবে।</p></header>{message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}<section className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-md)]"><div className="space-y-2"><Label htmlFor="setup-batch">ব্যাচ</Label><select id="setup-batch" className={selectClass} value={batchId} onChange={(event) => { setBatchId(event.target.value); setAvailable([]); setSelected([]); }}><option value="">ব্যাচ নির্বাচন করুন</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} ({batch.status})</option>)}</select></div>{batchId && <><fieldset><legend className="text-sm font-bold text-primary">কোচিং বিষয়</legend><div className="mt-3 space-y-2">{available.map((subject) => { const checked = selected.includes(subject.id); return <button type="button" key={subject.id} aria-pressed={checked} onClick={() => setSelected((current) => checked ? current.filter((id) => id !== subject.id) : [...current, subject.id])} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left", checked ? "border-primary bg-secondary/50" : "border-border")}><span className={cn("grid size-5 place-items-center rounded border", checked ? "border-primary bg-primary text-white" : "border-border")}>{checked && <Check className="size-3.5" />}</span><span><b className="block text-sm text-primary">{subject.nameBn || subject.name}</b><small className="text-muted">{subject.code}</small></span></button>; })}</div></fieldset><Button className="w-full" size="lg" disabled={saving || selected.length === 0} onClick={() => void save()}>{saving ? "সংরক্ষণ হচ্ছে…" : "বিষয় সংরক্ষণ করুন"}</Button></>}</section></div>;
}
