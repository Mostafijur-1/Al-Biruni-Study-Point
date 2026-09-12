"use client";

import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import type { SessionUser, StudentClass } from "@/types";
import type { MeResponseData } from "@/types/api";

const classes: Array<{ value: StudentClass; label: string }> = [
  { value: "class-9", label: "Class 9" }, { value: "class-10", label: "Class 10" },
  { value: "class-11", label: "Class 11" }, { value: "class-12", label: "Class 12" },
];

export function StudentOnboardingForm({ returnUrl }: { returnUrl?: string | null }) {
  const router = useRouter();
  const { data, isLoading, message, setData } = useApiQuery<MeResponseData>("/api/auth/me", { loadingMessage: "Loading your account...", errorMessage: "Please register with Google first." });
  const user = data?.user;

  useEffect(() => {
    if (user?.onboardingComplete) router.replace(returnUrl || "/student");
  }, [returnUrl, router, user?.onboardingComplete]);

  if (isLoading) return <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />;
  if (message || !user) return <Card><CardContent className="pt-6"><Alert variant="destructive">{message || "Please register with Google first."}</Alert></CardContent></Card>;
  if (user.onboardingComplete) return <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />;

  return <StudentOnboardingWizard user={user} returnUrl={returnUrl} setData={setData} />;
}

function StudentOnboardingWizard({ user, returnUrl, setData }: {
  user: SessionUser;
  returnUrl?: string | null;
  setData: Dispatch<SetStateAction<MeResponseData | null>>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(!user.studentClass ? 0 : !user.phone ? 1 : 2);
  const [studentClass, setStudentClass] = useState<StudentClass | "">(user.studentClass || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [schoolCollege, setSchoolCollege] = useState(user.schoolCollege || "");
  const [reference, setReference] = useState(user.reference || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(body: Record<string, unknown>, nextStep?: number) {
    setSaving(true); setError("");
    try {
      const { ok, payload } = await apiFetch<{ user: SessionUser; redirectTo?: string }>("/api/auth/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!ok || !isApiSuccess(payload)) { setError(getApiErrorMessage(payload, "Could not save this answer.")); return; }
      setData({ user: payload.data.user });
      if (payload.data.redirectTo) {
        window.dispatchEvent(new Event("absp-auth-changed")); router.replace(payload.data.redirectTo); router.refresh();
      } else if (nextStep !== undefined) setStep(nextStep);
    } finally { setSaving(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 0) { if (!studentClass) return setError("Please choose your class."); void save({ step: "class", studentClass }, 1); }
    else if (step === 1) { if (!phone.trim()) return setError("Phone number is required."); void save({ step: "phone", phone }, 2); }
    else if (step === 2) void save({ step: "schoolCollege", value: schoolCollege }, 3);
    else void save({ step: "reference", value: reference, returnUrl: returnUrl || undefined });
  }

  const isSchool = studentClass === "class-9" || studentClass === "class-10";
  const optional = step >= 2;
  const skipping = optional && ((step === 2 && !schoolCollege.trim()) || (step === 3 && !reference.trim()));

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4"><p className="text-xs font-bold uppercase tracking-widest text-accent">Set up your profile</p><span className="text-xs font-semibold text-muted">{step + 1} of 4</span></div>
        <div className="grid grid-cols-4 gap-2" aria-hidden>{[0, 1, 2, 3].map((item) => <span key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-primary" : "bg-secondary"}`} />)}</div>
        <CardTitle className="pt-2">{step === 0 ? "Which class are you in?" : step === 1 ? "What is your phone number?" : step === 2 ? `Which ${isSchool ? "school" : "college"} do you attend?` : "Were you referred by a teacher?"}</CardTitle>
        <CardDescription>{optional ? "This is optional. You can add or update it later from your profile." : "This information is required to personalize your learning."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          {step === 0 && <div className="grid grid-cols-2 gap-3">{classes.map((item) => <button key={item.value} type="button" onClick={() => setStudentClass(item.value)} className={`flex min-h-20 items-center justify-between rounded-xl border p-4 text-left font-bold transition ${studentClass === item.value ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/15" : "border-border bg-background hover:border-primary/50"}`}>{item.label}{studentClass === item.value && <Check className="size-5" />}</button>)}</div>}
          {step === 1 && <div className="space-y-2"><Label htmlFor="onboarding-phone">Phone number</Label><Input id="onboarding-phone" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoFocus /></div>}
          {step === 2 && <div className="space-y-2"><Label htmlFor="onboarding-school">{isSchool ? "School" : "College"} name</Label><Input id="onboarding-school" value={schoolCollege} onChange={(event) => setSchoolCollege(event.target.value)} placeholder={`Enter your ${isSchool ? "school" : "college"} name`} autoFocus /></div>}
          {step === 3 && <div className="space-y-2"><Label htmlFor="onboarding-reference">Teacher name</Label><Input id="onboarding-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Enter the teacher's name" autoFocus /></div>}
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="flex items-center gap-3">
            {step > 0 && <Button type="button" variant="ghost" onClick={() => { setError(""); setStep(step - 1); }} disabled={saving}><ChevronLeft className="size-4" />Back</Button>}
            <Button type="submit" className="ml-auto" loading={saving}>{skipping ? "Skip" : step === 3 ? "Finish" : "Continue"}<ArrowRight className="size-4" /></Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
