"use client";

import { useEffect, useState } from "react";

import type { SessionUser } from "@/types";

type MeResponse = {
  success: boolean;
  data?: { user: SessionUser };
  error?: { message: string };
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

export function ProfilePanel() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [message, setMessage] = useState("Loading profile...");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await response.json()) as MeResponse;

        if (!active) {
          return;
        }

        if (!response.ok || !payload.success || !payload.data?.user) {
          setMessage(payload.error?.message || "Could not load profile.");
          return;
        }

        setUser(payload.data.user);
        setMessage("");
      } catch {
        if (active) {
          setMessage("Could not load profile.");
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

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
