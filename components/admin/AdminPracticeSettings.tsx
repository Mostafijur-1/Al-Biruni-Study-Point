"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileQuestion, Gauge, Save, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";

type PracticeTestSettings = {
  maxQuestionsPerTest: number;
  secondsPerQuestion: number;
  passMarkPercent: number;
};

const defaults: PracticeTestSettings = {
  maxQuestionsPerTest: 25,
  secondsPerQuestion: 45,
  passMarkPercent: 60,
};

export function AdminPracticeSettings() {
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { ok, payload } = await apiFetch<PracticeTestSettings>("/api/admin/practice-settings");
        if (ok && isApiSuccess(payload)) setSettings(payload.data);
      } catch {
        setError("Practice Setting লোড করা যায়নি। বর্তমান Default Value দেখানো হচ্ছে।");
      } finally {
        setLoading(false);
      }
    }
    void loadSettings();
  }, []);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { ok, payload } = await apiFetch("/api/admin/practice-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!ok || !isApiSuccess(payload)) {
        setError(getApiErrorMessage(payload, "Practice Setting Save করা যায়নি।"));
      } else {
        setSaved(true);
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  const estimatedMinutes = Math.ceil((settings.maxQuestionsPerTest * settings.secondsPerQuestion) / 60);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Assessment Control</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-primary sm:text-3xl">Practice Setting</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Set the rules used for every automatically generated student practice test. Question uploads are managed separately in Question Bank.
        </p>
      </header>

      <form onSubmit={saveSettings} className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3 border-b border-border bg-secondary/45 p-5">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Settings2 className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Practice Test-এর নিয়ম</h2>
            <p className="text-xs text-muted">এখান থেকে Test-এর প্রশ্নসংখ্যা, সময় ও Pass-এর নিয়ম Control করা হয়।</p>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted">বর্তমান Setting লোড হচ্ছে…</div>
        ) : (
          <div className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <SettingField
                id="max-questions"
                icon={FileQuestion}
                label="Questions per test"
                hint="Allowed range: 1–100"
                value={settings.maxQuestionsPerTest}
                min={1}
                max={100}
                onChange={(value) => setSettings((current) => ({ ...current, maxQuestionsPerTest: value }))}
              />
              <SettingField
                id="seconds-per-question"
                icon={Clock3}
                label="Seconds per question"
                hint="Allowed range: 10–300 seconds"
                value={settings.secondsPerQuestion}
                min={10}
                max={300}
                onChange={(value) => setSettings((current) => ({ ...current, secondsPerQuestion: value }))}
              />
              <SettingField
                id="pass-mark"
                icon={Gauge}
                label="Pass mark"
                suffix="%"
                hint="Allowed range: 1–100%"
                value={settings.passMarkPercent}
                min={1}
                max={100}
                onChange={(value) => setSettings((current) => ({ ...current, passMarkPercent: value }))}
              />
            </div>

            <section className="rounded-xl border border-sky-200 bg-sky-50 p-4" aria-label="Current practice test preview">
              <p className="text-xs font-black uppercase tracking-wider text-sky-800">শিক্ষার্থীর বর্তমান Experience</p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {settings.maxQuestionsPerTest}টি প্রশ্ন · প্রায় {estimatedMinutes} মিনিট · Pass করতে {settings.passMarkPercent}% প্রয়োজন
              </p>
            </section>

            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            {saved && <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-4" /> Practice Setting Save হয়েছে।</p>}

            <div className="flex justify-end border-t border-border pt-5">
              <Button type="submit" size="lg" loading={saving} disabled={saving} className="min-w-44 rounded-xl">
                <Save className="size-4" /> {saving ? "Save হচ্ছে…" : "Setting Save করুন"}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function SettingField({ id, icon: Icon, label, hint, value, min, max, suffix, onChange }: {
  id: string;
  icon: typeof FileQuestion;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="rounded-xl border border-border bg-surface p-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
      <span className="flex items-center gap-2 text-sm font-bold text-primary"><Icon className="size-4 text-accent" /> {label}</span>
      <span className="relative mt-3 block">
        <input id={id} type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-12 w-full rounded-lg border border-input bg-white px-3 pr-10 text-xl font-black tabular-nums text-primary outline-none" />
        {suffix && <span className="absolute right-3 top-3 text-sm font-bold text-muted">{suffix}</span>}
      </span>
      <span className="mt-2 block text-xs text-muted">{hint}</span>
    </label>
  );
}
