"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Check, GraduationCap } from "lucide-react";

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
  schoolCollege?: string;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  teacherDomain?: {
    isAll: boolean;
    classes: StudentClass[];
    subjects: string[];
  };
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

  // New state hooks for Teacher Domain management
  const [selectedTeacher, setSelectedTeacher] = useState<AdminUserRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAllDomain, setIsAllDomain] = useState(false);
  const [allowedClasses, setAllowedClasses] = useState<StudentClass[]>([]);
  const [allowedSubjects, setAllowedSubjects] = useState<string[]>([]);

  const { data, message, isLoading, setData } = useApiQuery<{ users: AdminUserRow[] }>(
    `/api/admin/users?role=${role}`,
    {
      loadingMessage: locale === "bn" ? "লোড হচ্ছে..." : "Loading...",
      errorMessage: locale === "bn" ? "তালিকা লোড করা যায়নি।" : "Could not load users.",
    },
  );

  const users = data?.users ?? [];

  const updateUser = useCallback(
    async (
      id: string,
      body: {
        isActive?: boolean;
        approvalStatus?: ApprovalStatus;
        teacherDomain?: { isAll: boolean; classes: string[]; subjects: string[] };
      },
    ) => {
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

  // ── Domain modal helpers ────────────────────────────────────────────────
  function openDomainModal(user: AdminUserRow) {
    setSelectedTeacher(user);
    setIsAllDomain(user.teacherDomain?.isAll ?? false);
    setAllowedClasses(user.teacherDomain?.classes ?? []);
    setAllowedSubjects(user.teacherDomain?.subjects ?? []);
    setIsModalOpen(true);
  }

  function toggleClassSelection(cls: StudentClass) {
    setAllowedClasses((prev) => {
      const nextClasses = prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls];
      const availableSubjects = getAvailableSubjectsForClasses(nextClasses);
      setAllowedSubjects((prevSubjects) => prevSubjects.filter((sub) => availableSubjects.includes(sub)));
      return nextClasses;
    });
  }

  function toggleSubjectSelection(sub: string) {
    setAllowedSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  }

  async function handleSaveDomain() {
    if (!selectedTeacher) return;
    await updateUser(selectedTeacher.id, {
      teacherDomain: {
        isAll: isAllDomain,
        classes: allowedClasses,
        subjects: allowedSubjects,
      },
    });
    setIsModalOpen(false);
    setSelectedTeacher(null);
  }

  // ── Page title ─────────────────────────────────────────────────────────
  const title =
    role === "student"
      ? "Manage students"
      :  "Manage teachers";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {role === "student"
            ?"Activate or deactivate student accounts."
            : "Approve teachers and control account access."}
        </p>
      </div>

      {actionMessage && (
        <Alert variant={actionError ? "destructive" : "success"}>{actionMessage}</Alert>
      )}

      {isLoading ? (
        <ul className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <li key={i} className="rounded-xl border border-border bg-card/45 p-4 space-y-4 shadow-[var(--shadow-sm)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-36 rounded bg-secondary animate-pulse" />
                    <div className="h-5 w-16 rounded-full bg-secondary animate-pulse" />
                    {role === "teacher" && (
                      <div className="h-5 w-16 rounded-full bg-secondary animate-pulse" />
                    )}
                  </div>
                  <div className="h-4 w-48 rounded bg-secondary animate-pulse" />
                  <div className="h-3.5 w-32 rounded bg-secondary animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-20 rounded-lg bg-secondary animate-pulse" />
                  {role === "teacher" && (
                    <div className="h-9 w-28 rounded-lg bg-secondary animate-pulse" />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : message ? (
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
                        ?"Active"
                        :"Inactive"}
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
                  {role === "student" && user.schoolCollege && (
                    <p className="mt-0.5 text-sm text-muted-foreground/90">
                      <span className="font-semibold text-foreground/80">{user.schoolCollege}</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {"Joined"}:{" "}
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
                        {"Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={pendingId === user.id}
                        onClick={() => updateUser(user.id, { approvalStatus: "rejected" })}
                      >
                        {"Reject"}
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
                      ? "Deactivate"
                      : "Activate"}
                  </Button>
                  {role === "teacher" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDomainModal(user)}
                    >
                      {"Manage Domain"}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Teacher Domain Configuration Modal */}
      {isModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="border-b border-border pb-4">
              <h3 className="font-display text-xl font-bold text-primary flex items-center gap-2">
                <span className="rounded-lg bg-primary/10 p-1.5 text-primary">
                  <GraduationCap className="size-5" />
                </span>
                {`Manage Domain - ${selectedTeacher.name}`}
              </h3>
              <p className="text-xs text-muted mt-1.5">
                {locale === "bn"
                  ? "এই শিক্ষক কোন কোন ক্লাস ও বিষয়ের রেজাল্ট দেখতে পারবেন তা সিলেক্ট করুন।"
                  : "Select which classes and subjects this teacher is authorized to view results for."}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-5 space-y-6">
              {/* Full Access Premium Toggle Card */}
              <div
                className={cn(
                  "rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 flex items-center justify-between",
                  isAllDomain
                    ? "border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/10"
                    : "border-border bg-surface/60 hover:bg-secondary/20"
                )}
                onClick={() => setIsAllDomain(!isAllDomain)}
              >
                <div className="flex items-start gap-3.5 pr-4">
                  <div className={cn(
                    "size-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-150",
                    isAllDomain ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-white"
                  )}>
                    {isAllDomain && <Check className="size-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">
                      {locale === "bn" ? "সম্পূর্ণ অ্যাক্সেস (সব ক্লাস এবং বিষয়)" : "Full Access (All Classes & Subjects)"}
                    </p>
                    <p className="text-2xs text-muted mt-0.5 leading-relaxed">
                      {locale === "bn"
                        ? "এটি Active থাকলে এই শিক্ষক সকল ছাত্র-ছাত্রীর সকল বিষয়ের পরীক্ষার রেজাল্ট দেখতে পারবেন।"
                        : "If enabled, this teacher can view all exam results for all subjects and classes."}
                    </p>
                  </div>
                </div>
              </div>

              {!isAllDomain && (
                <div className="space-y-6">
                  {/* Classes Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                      {locale === "bn" ? "অনুমোদিত ক্লাস" : "Allowed Classes"}
                    </h4>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                      {ALL_CLASSES.map((cls) => {
                        const isChecked = allowedClasses.includes(cls);
                        const isHsc = cls === "class-11" || cls === "class-12";
                        return (
                          <div
                            key={cls}
                            onClick={() => toggleClassSelection(cls)}
                            className={cn(
                              "relative rounded-xl border-2 p-3.5 cursor-pointer flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                              isChecked
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border bg-surface/40 hover:border-primary/30"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                                isHsc ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"
                              )}>
                                {isHsc ? "HSC" : "SSC"}
                              </span>
                              <div className={cn(
                                "size-4 rounded-full border flex items-center justify-center transition-colors",
                                isChecked ? "border-primary bg-primary text-white" : "border-border bg-white"
                              )}>
                                {isChecked && <Check className="size-2.5 stroke-[3]" />}
                              </div>
                            </div>
                            <p className="mt-3.5 text-sm font-bold text-primary">
                              {getClassLabel(cls, locale)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subjects Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                      {locale === "bn" ? "অনুমোদিত বিষয়" : "Allowed Subjects"}
                    </h4>
                    
                    {allowedClasses.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-surface/20 p-8 text-center flex flex-col items-center justify-center">
                        <AlertCircle className="size-8 text-muted/50 mb-2.5 animate-pulse" />
                        <p className="text-sm font-medium text-muted">
                          {locale === "bn"
                            ? "বিষয় কনফিগার করার জন্য প্রথমে উপরে ক্লাস সিলেক্ট করুন।"
                            : "Please select at least one class above to configure subjects."}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-surface/30 p-4">
                        <div className="flex flex-wrap gap-2.5 max-h-[260px] overflow-y-auto">
                          {getAvailableSubjectsForClasses(allowedClasses).map((sub) => {
                            const isChecked = allowedSubjects.includes(sub);
                            const badgeText = getSubjectBadge(sub);
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => toggleSubjectSelection(sub)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all duration-150",
                                  isChecked
                                    ? "bg-primary text-white border-primary shadow-sm hover:bg-primary/95"
                                    : "bg-surface text-muted border-border hover:border-primary/30 hover:bg-secondary/40"
                                )}
                              >
                                {isChecked && <Check className="size-3" />}
                                <span>{sub}</span>
                                <span className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase shrink-0",
                                  isChecked 
                                    ? "bg-white/20 text-white" 
                                    : badgeText === "HSC" 
                                      ? "bg-amber-100 text-amber-950" 
                                      : badgeText === "SSC" 
                                        ? "bg-blue-100 text-blue-950" 
                                        : "bg-purple-100 text-purple-950"
                                )}>
                                  {badgeText}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedTeacher(null);
                }}
              >
                {locale === "bn" ? "বাতিল" : "Cancel"}
              </Button>
              <Button onClick={handleSaveDomain}>
                {locale === "bn" ? "সংরক্ষণ করুন" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ALL_CLASSES: StudentClass[] = ["class-9", "class-10", "class-11", "class-12"];

function getAvailableSubjectsForClasses(classes: StudentClass[]): string[] {
  const subjectsSet = new Set<string>();
  if (classes.includes("class-9") || classes.includes("class-10")) {
    subjectsSet.add("Physics");
    subjectsSet.add("Chemistry");
    subjectsSet.add("Math");
    subjectsSet.add("Higher Math");
    subjectsSet.add("ICT");
  }
  if (classes.includes("class-11") || classes.includes("class-12")) {
    subjectsSet.add("Physics 1st Paper");
    subjectsSet.add("Physics 2nd Paper");
    subjectsSet.add("Chemistry 1st Paper");
    subjectsSet.add("Chemistry 2nd Paper");
    subjectsSet.add("Higher Math 1st Paper");
    subjectsSet.add("Higher Math 2nd Paper");
    subjectsSet.add("ICT");
  }
  const orderedSubjects = [
    "Physics",
    "Chemistry",
    "Math",
    "Higher Math",
    "Physics 1st Paper",
    "Physics 2nd Paper",
    "Chemistry 1st Paper",
    "Chemistry 2nd Paper",
    "Higher Math 1st Paper",
    "Higher Math 2nd Paper",
    "ICT",
  ];
  return orderedSubjects.filter((sub) => subjectsSet.has(sub));
}

function getSubjectBadge(sub: string): string {
  const sscSubjects = ["Physics", "Chemistry", "Math", "Higher Math"];
  const hscSubjects = [
    "Physics 1st Paper",
    "Physics 2nd Paper",
    "Chemistry 1st Paper",
    "Chemistry 2nd Paper",
    "Higher Math 1st Paper",
    "Higher Math 2nd Paper",
  ];
  if (sscSubjects.includes(sub)) return "SSC";
  if (hscSubjects.includes(sub)) return "HSC";
  if (sub === "ICT") return "SSC / HSC";
  return "";
}
