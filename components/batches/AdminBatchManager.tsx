"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, CheckCircle2, Layers3, Pencil, Plus, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type BatchStatus = "planned" | "active" | "closed" | "archived";
type Batch = {
  id: string;
  name: string;
  activeEnrollmentCount: number;
  status: BatchStatus;
};

const statusLabel: Record<BatchStatus, string> = {
  planned: "পরিকল্পিত",
  active: "সক্রিয়",
  closed: "বন্ধ",
  archived: "আর্কাইভ",
};

export function AdminBatchManager() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Batch>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<{ batches: Batch[] }>(
      "/api/batches?status=all&limit=100",
    );
    if (result.ok && isApiSuccess(result.payload)) {
      setBatches(result.payload.data.batches);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  function startCreate() {
    setEditing(undefined);
    setName("");
    setOpen(true);
  }

  function startEdit(batch: Batch) {
    setEditing(batch);
    setName(batch.name);
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(undefined);
    setName("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const body = editing
      ? {
        batchId: editing.id,
        name,
        reason: "অ্যাডমিন কর্তৃক ব্যাচের নাম হালনাগাদ",
      }
      : {
        name,
      };

    const result = await apiFetch("/api/batches", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "ব্যাচ সংরক্ষণ করা যায়নি।"));
    } else {
      setError(false);
      setMessage(
        editing
          ? "ব্যাচের নাম আপডেট হয়েছে।"
          : "নতুন ব্যাচ তৈরি হয়েছে। এখন বিষয় ও fee configure করুন।",
      );
      closeForm();
      await load();
    }
    setSaving(false);
  }

  async function changeStatus(batch: Batch, status: BatchStatus) {
    const action = status === "active" ? "সক্রিয়" : status === "closed" ? "বন্ধ" : "আর্কাইভ";
    if (!window.confirm(`${batch.name} ব্যাচটি ${action} করবেন?`)) return;
    setSaving(true);
    setMessage("");
    const result = await apiFetch("/api/batches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: batch.id,
        status,
        reason: `অ্যাডমিন কর্তৃক ব্যাচ ${action}`,
      }),
    });
    if (!result.ok || !isApiSuccess(result.payload)) {
      setError(true);
      setMessage(getApiErrorMessage(result.payload, "ব্যাচের অবস্থা পরিবর্তন করা যায়নি।"));
    } else {
      setError(false);
      setMessage(`ব্যাচটি ${action} হয়েছে।`);
      await load();
    }
    setSaving(false);
  }

  return (
    <section className="space-y-5" aria-labelledby="batch-management-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-accent-foreground">
            Batch operations
          </p>
          <h2 id="batch-management-title" className="mt-1 text-2xl font-black text-primary">
            ব্যাচ তৈরি ও ব্যবস্থাপনা
          </h2>
        </div>
        <Button onClick={startCreate}>
          <Plus className="size-4" /> নতুন ব্যাচ
        </Button>
      </div>

      {message && <Alert variant={error ? "destructive" : "success"}>{message}</Alert>}

      {open && (
        <form
          onSubmit={save}
          className="mx-auto max-w-xl rounded-3xl border border-primary/30 bg-card p-5 shadow-[var(--shadow-md)]"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-black text-primary">
              {editing ? "ব্যাচের নাম সম্পাদনা" : "নতুন ব্যাচ"}
            </h3>
            <button type="button" aria-label="ফর্ম বন্ধ করুন" onClick={closeForm}>
              <X className="size-5 text-muted" />
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input
              id="batch-name"
              required
              minLength={2}
              maxLength={120}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="যেমন: HSC 2029"
            />
          </div>
          <Button className="mt-5 w-full" type="submit" disabled={saving}>
            {saving ? "সংরক্ষণ হচ্ছে…" : "ব্যাচ সংরক্ষণ করুন"}
          </Button>
        </form>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-secondary" />
      ) : batches.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-muted">
          কোনো ব্যাচ নেই।
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {batches.map((batch) => (
            <article key={batch.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Layers3 className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-black text-primary">{batch.name}</h3>
                    <p className="text-xs text-muted">{batch.activeEnrollmentCount} শিক্ষার্থী</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-black",
                    batch.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : batch.status === "planned"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-secondary text-muted",
                  )}
                >
                  {statusLabel[batch.status]}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(batch.status === "planned" || batch.status === "active") && (
                  <Button size="sm" variant="outline" onClick={() => startEdit(batch)}>
                    <Pencil className="size-4" /> নাম সম্পাদনা
                  </Button>
                )}
                {batch.status === "planned" && (
                  <Button size="sm" onClick={() => void changeStatus(batch, "active")} disabled={saving}>
                    <CheckCircle2 className="size-4" /> সক্রিয় করুন
                  </Button>
                )}
                {batch.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => void changeStatus(batch, "closed")} disabled={saving}>
                    বন্ধ করুন
                  </Button>
                )}
                {(batch.status === "planned" || batch.status === "closed") && (
                  <Button size="sm" variant="outline" onClick={() => void changeStatus(batch, "archived")} disabled={saving}>
                    <Archive className="size-4" /> আর্কাইভ
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
