"use client";

import { useCallback, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { getClassLabel } from "@/lib/content/classes";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ApprovalStatus, StudentClass, UserRole } from "@/types";

type AdminUserRow = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  studentClass?: StudentClass;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  createdAt: string;
};

type AdminUsersPanelProps = {
  locale: Locale;
  role: Extract<UserRole, "student" | "teacher">;
};

export function AdminUsersPanel({ locale, role }: AdminUsersPanelProps) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, message, setData } = useApiQuery<{ users: AdminUserRow[] }>(
    `/api/admin/users?role=${role}`,
    {
      loadingMessage: locale === "bn" ? "লোড হচ্ছে..." : "Loading...",
      errorMessage: locale === "bn" ? "তালিকা লোড করা যায়নি।" : "Could not load users.",
    },
  );

  const users = data?.users ?? [];

  const updateUser = useCallback(
    async (id: string, body: { isActive?: boolean; approvalStatus?: ApprovalStatus }) => {
      setPendingId(id);
      setActionMessage(null);

      const { ok, payload } = await apiFetch<{ user: AdminUserRow }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setPendingId(null);

      if (!ok || !isApiSuccess(payload)) {
        setActionError(true);
        setActionMessage(getApiErrorMessage(payload, "Update failed."));
        return;
      }

      setActionError(false);
      setActionMessage(
        locale === "bn" ? "অ্যাকাউন্ট আপডেট হয়েছে।" : "Account updated successfully.",
      );
      setData((current) =>
        current
          ? {
              users: current.users.map((user) =>
                user.id === id ? payload.data.user : user,
              ),
            }
          : current,
      );
    },
    [locale, setData],
  );

  const title =
    role === "student"
      ? locale === "bn"
        ? "শিক্ষার্থী পরিচালনা"
        : "Manage students"
      : locale === "bn"
        ? "শিক্ষক পরিচালনা"
        : "Manage teachers";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {role === "student"
            ? locale === "bn"
              ? "শিক্ষার্থী অ্যাকাউন্ট সক্রিয় বা নিষ্ক্রিয় করুন।"
              : "Activate or deactivate student accounts."
            : locale === "bn"
              ? "শিক্ষক অনুমোদন, সক্রিয় বা নিষ্ক্রিয় করুন।"
              : "Approve teachers and control account access."}
        </p>
      </div>

      {actionMessage && (
        <Alert variant={actionError ? "destructive" : "success"}>{actionMessage}</Alert>
      )}

      {message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{message}</p>
      ) : users.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          {locale === "bn" ? "কোনো ব্যবহারকারী নেই।" : "No users found."}
        </p>
      ) : (
        <ul className="space-y-3">
          {users.map((user) => (
            <li
              key={user.id}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-primary">{user.name}</h2>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        user.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-secondary text-muted",
                      )}
                    >
                      {user.isActive
                        ? locale === "bn"
                          ? "সক্রিয়"
                          : "Active"
                        : locale === "bn"
                          ? "নিষ্ক্রিয়"
                          : "Inactive"}
                    </span>
                    {role === "teacher" && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          user.approvalStatus === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : user.approvalStatus === "pending"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-red-100 text-red-800",
                        )}
                      >
                        {user.approvalStatus}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {user.phone || user.email || "—"}
                    {user.studentClass &&
                      ` · ${getClassLabel(user.studentClass, locale)}`}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {locale === "bn" ? "যোগদান" : "Joined"}:{" "}
                    {new Date(user.createdAt).toLocaleDateString(
                      locale === "bn" ? "bn-BD" : "en-US",
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {role === "teacher" && user.approvalStatus === "pending" && (
                    <>
                      <Button
                        size="sm"
                        loading={pendingId === user.id}
                        onClick={() => updateUser(user.id, { approvalStatus: "approved" })}
                      >
                        {locale === "bn" ? "অনুমোদন" : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={pendingId === user.id}
                        onClick={() => updateUser(user.id, { approvalStatus: "rejected" })}
                      >
                        {locale === "bn" ? "প্রত্যাখ্যান" : "Reject"}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant={user.isActive ? "secondary" : "default"}
                    loading={pendingId === user.id}
                    onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                  >
                    {user.isActive
                      ? locale === "bn"
                        ? "নিষ্ক্রিয় করুন"
                        : "Deactivate"
                      : locale === "bn"
                        ? "সক্রিয় করুন"
                        : "Activate"}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
