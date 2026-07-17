"use client";

import { useState } from "react";
import { Edit, Lock, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import type { MeResponseData } from "@/types/api";
import type { SessionUser, StudentClass } from "@/types";

type ProfileUpdatePayload = {
  name: string;
  email: string;
  studentClass?: StudentClass;
  schoolCollege?: string;
  reference?: string;
};

const classLabels: Record<string, string> = {
  "class-9": "Class 9",
  "class-10": "Class 10",
  "class-11": "Class 11",
  "class-12": "Class 12",
};

const roleLabels: Record<string, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Admin",
};

function formatBillingDate(value?: string) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getTeacherPaymentMessage(chargeDueAt?: string, isChargeExpired?: boolean) {
  if (!chargeDueAt) {
    return "পেমেন্টের সময় এখনো সেট করা হয়নি।";
  }

  const now = new Date();
  const dueDate = new Date(chargeDueAt);
  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isChargeExpired || daysLeft <= 0) {
    return "পেমেন্টের সময় শেষ হয়েছে। অ্যাকাউন্ট সক্রিয় রাখতে অ্যাডমিনের সাথে যোগাযোগ করুন।";
  }

  return `পেমেন্ট করতে আর ${daysLeft.toLocaleString("bn-BD")} দিন বাকি।`;
}

export function ProfilePanel() {
  const { data, message, isLoading, setData } = useApiQuery<MeResponseData>("/api/auth/me", {
    loadingMessage: "Loading profile...",
    errorMessage: "Could not load profile.",
  });

  const user = data?.user;

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [schoolCollege, setSchoolCollege] = useState("");
  const [reference, setReference] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <section className="animate-pulse rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 rounded bg-secondary animate-pulse" />
          <div className="h-8 w-24 rounded-lg bg-secondary animate-pulse" />
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="size-16 rounded-xl bg-secondary animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-7 w-48 rounded bg-secondary animate-pulse" />
            <div className="h-4 w-20 rounded bg-secondary animate-pulse" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-background/50 p-4 space-y-2">
              <div className="h-3.5 w-12 rounded bg-secondary animate-pulse" />
              <div className="h-5 w-32 rounded bg-secondary animate-pulse mt-1" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (message) {
    return <p className="rounded-xl border border-border bg-card p-5 text-muted">{message}</p>;
  }

  if (!user) {
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setUpdating(true);
    setError("");

    try {
      const payloadBody: ProfileUpdatePayload = {
        name,
        email: email || "",
      };

      if (user.role === "student") {
        payloadBody.studentClass = studentClass as StudentClass;
        payloadBody.schoolCollege = schoolCollege || "";
        payloadBody.reference = reference || "";
      }

      const { ok, payload } = await apiFetch<{ user: SessionUser }>("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });

      if (ok && isApiSuccess(payload)) {
        setData({ user: payload.data.user });
        window.dispatchEvent(new Event("absp-auth-changed"));
        setIsEditing(false);
      } else {
        setError(getApiErrorMessage(payload, "Failed to update profile."));
      }
    } catch {
      setError("An error occurred while connecting to the server.");
    } finally {
      setUpdating(false);
    }
  }

  const isSchool = studentClass === "class-9" || studentClass === "class-10";
  const schoolCollegeLabel = isSchool ? "School" : "College";
  const schoolCollegePlaceholder = isSchool ? "Enter your school name" : "Enter your college name";

  const userIsSchool = user.studentClass === "class-9" || user.studentClass === "class-10";
  const userSchoolCollegeLabel = userIsSchool ? "School" : "College";
  const teacherUsage = user.role === "teacher" ? user.teacherUsage : undefined;

  if (isEditing) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Edit Profile</p>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter your full name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-phone" className="flex items-center gap-1.5">
                Phone Number
                <Lock className="size-3.5 text-muted-foreground" />
              </Label>
              <Input
                id="edit-phone"
                value={user.phone || ""}
                disabled
                className="bg-muted cursor-not-allowed text-muted-foreground"
              />
              <p className="text-2xs text-muted-foreground">Phone number cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (Optional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. student@example.com"
              />
            </div>
          </div>

          {user.role === "student" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-class">Class</Label>
                  <select
                    id="edit-class"
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <option value="class-9">Class 9</option>
                    <option value="class-10">Class 10</option>
                    <option value="class-11">Class 11</option>
                    <option value="class-12">Class 12</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-schoolCollege">{schoolCollegeLabel}</Label>
                  <Input
                    id="edit-schoolCollege"
                    value={schoolCollege}
                    onChange={(e) => setSchoolCollege(e.target.value)}
                    placeholder={schoolCollegePlaceholder}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reference">Reference (Teacher&apos;s name)</Label>
                <Input
                  id="edit-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Mohammad Ali"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setName(user.name || "");
                setEmail(user.email || "");
                setStudentClass(user.studentClass || "class-9");
                setSchoolCollege(user.schoolCollege || "");
                setReference(user.reference || "");
                setError("");
                setIsEditing(false);
              }}
              disabled={updating}
              className="flex items-center gap-1.5"
            >
              <X className="size-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              loading={updating}
              className="flex items-center gap-1.5"
            >
              <Save className="size-4" />
              Save Changes
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Profile</p>
        {user.role !== "teacher" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError("");
              setName(user.name || "");
              setEmail(user.email || "");
              setStudentClass(user.studentClass || "class-9");
              setSchoolCollege(user.schoolCollege || "");
              setReference(user.reference || "");
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Edit className="size-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
          {user.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-primary">{user.name}</h1>
          <p className="mt-1 text-sm font-medium text-muted">{roleLabels[user.role]}</p>
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Phone</dt>
          <dd className="mt-1 font-semibold text-foreground">{user.phone || "Not provided"}</dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Email</dt>
          <dd className="mt-1 font-semibold text-foreground">{user.email || "Not provided"}</dd>
        </div>
        {user.role === "student" && (
          <>
            <div className="rounded-lg border border-border bg-background p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Class</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {user.studentClass ? classLabels[user.studentClass] : "Not provided"}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">{userSchoolCollegeLabel}</dt>
              <dd className="mt-1 font-semibold text-foreground">{user.schoolCollege || "Not provided"}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background p-4 sm:col-span-2">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Reference (Teacher)</dt>
              <dd className="mt-1 font-semibold text-foreground">{user.reference || "None"}</dd>
            </div>
          </>
        )}
        {user.role === "teacher" && teacherUsage && (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:col-span-2">
              <dt className="text-xs font-bold uppercase tracking-wide text-amber-800">Payment Notice</dt>
              <dd className="mt-1 font-semibold text-amber-900">
                {getTeacherPaymentMessage(teacherUsage.chargeDueAt, teacherUsage.isChargeExpired)}
              </dd>
            </div>
          
            <div className="rounded-lg border border-border bg-background p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Monthly Charge</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {teacherUsage.monthlyChargeTk.toLocaleString('bn-BD')} টাকা
              </dd>
            
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Billing Start</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatBillingDate(teacherUsage.chargeCycleStartedAt)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Billing End</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatBillingDate(teacherUsage.chargeDueAt)}
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}
