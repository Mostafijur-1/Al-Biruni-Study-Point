"use client";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import type { MeResponseData } from "@/types/api";

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

export function ProfilePanel() {
  const { data, message } = useApiQuery<MeResponseData>("/api/auth/me", {
    loadingMessage: "Loading profile...",
    errorMessage: "Could not load profile.",
  });

  const user = data?.user;

  if (message) {
    return <p className="rounded-xl border border-border bg-card p-5 text-muted">{message}</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <p className="text-xs font-bold uppercase tracking-widest text-accent">Profile</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-16 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
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
          <div className="rounded-lg border border-border bg-background p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-muted">Class</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {user.studentClass ? classLabels[user.studentClass] : "Not provided"}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
