"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Check, GraduationCap } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { getClassLabel } from "@/lib/content/classes";
import { useApiQuery } from "@/lib/hooks/use-api-query";
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
  reference?: string;
  teacherDomain?: {
    isAll: boolean;
    classes: StudentClass[];
    subjects: string[];
    students: string[];
  };
  teacherUsage?: {
    imageQuestionUploadMonth: string;
    imageQuestionUploadCount: number;
    monthlyChargeTk: number;
    chargeCycleStartedAt?: string;
    chargeDueAt?: string;
    lastChargeRefreshedAt?: string;
    isChargeExpired?: boolean;
  };
  createdAt: string;
};

type AdminUsersPanelProps = {
    role: Extract<UserRole, "student" | "teacher">;
};

function formatTeacherBillingDate(value: string | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminUsersPanel({ role }: AdminUsersPanelProps) {
  const locale = "bn";
      const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // New state hooks for Teacher Domain management
  const [selectedTeacher, setSelectedTeacher] = useState<AdminUserRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAllDomain, setIsAllDomain] = useState(false);
  const [allowedClasses, setAllowedClasses] = useState<StudentClass[]>([]);
  const [allowedSubjects, setAllowedSubjects] = useState<string[]>([]);
  const [allowedStudents, setAllowedStudents] = useState<string[]>([]);
  const [studentSearchRef, setStudentSearchRef] = useState("");
  const [studentSearchName, setStudentSearchName] = useState("");
  const [studentSearchGlobalRef, setStudentSearchGlobalRef] = useState(""); // search for students by reference in the main students list

  const { data, message, isLoading, setData } = useApiQuery<{ users: AdminUserRow[] }>(
    `/api/admin/users?role=${role}`,
    {
      loadingMessage: "লোড হচ্ছে...",
      errorMessage: "তালিকা লোড করা যায়নি।",
    },
  );

  // Load students for domain assignments
  const { data: allStudentsData } = useApiQuery<{ users: AdminUserRow[] }>(
    "/api/admin/users?role=student",
    {
      enabled: !!(isModalOpen && selectedTeacher && role === "teacher"),
      loadingMessage: "Loading students...",
      errorMessage: "Could not load students.",
    }
  );

  const users = data?.users ?? [];
  const allStudents = allStudentsData?.users ?? [];

  const filteredStudents = allStudents.filter((st) => {
    const matchesRef = studentSearchRef
      ? st.reference?.toLowerCase().includes(studentSearchRef.toLowerCase())
      : true;
    const matchesName = studentSearchName
      ? st.name.toLowerCase().includes(studentSearchName.toLowerCase()) || st.phone?.includes(studentSearchName)
      : true;
    return matchesRef && matchesName;
  });

  const displayedUsers = users.filter((u) => {
    if (role === "student" && studentSearchGlobalRef) {
      return u.reference?.toLowerCase().includes(studentSearchGlobalRef.toLowerCase());
    }
    return true;
  });

  const updateUser = useCallback(
    async (
      id: string,
      body: {
        isActive?: boolean;
        approvalStatus?: ApprovalStatus;
        refreshCharge?: boolean;
        teacherDomain?: { isAll: boolean; classes: string[]; subjects: string[]; students?: string[] };
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
        "অ্যাকাউন্ট আপডেট হয়েছে।",
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
    [setData],
  );

  // ── Domain modal helpers ────────────────────────────────────────────────
  function openDomainModal(user: AdminUserRow) {
    setSelectedTeacher(user);
    setIsAllDomain(user.teacherDomain?.isAll ?? false);
    setAllowedClasses(user.teacherDomain?.classes ?? []);
    setAllowedSubjects(user.teacherDomain?.subjects ?? []);
    setAllowedStudents(user.teacherDomain?.students ?? []);
    setStudentSearchRef("");
    setStudentSearchName("");
    setIsModalOpen(true);
  }

  function toggleStudentSelection(stId: string) {
    setAllowedStudents((prev) =>
      prev.includes(stId) ? prev.filter((id) => id !== stId) : [...prev, stId]
    );
  }

  function handleSelectAllFilteredStudents() {
    const filteredIds = filteredStudents.map((st) => st.id);
    setAllowedStudents((prev) => {
      const next = [...prev];
      for (const id of filteredIds) {
        if (!next.includes(id)) {
          next.push(id);
        }
      }
      return next;
    });
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
        students: allowedStudents,
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

      {role === "student" && (
        <div className="flex max-w-md gap-2 rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-sm)]">
          <Input
            placeholder={"রেফারেন্স দিয়ে ফিল্টার করুন..."}
            value={studentSearchGlobalRef}
            onChange={(e) => setStudentSearchGlobalRef(e.target.value)}
            className="flex-1"
          />
        </div>
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
          {"কোনো ব্যবহারকারী নেই।"}
        </p>
      ) : (
        <ul className="space-y-3">
          {displayedUsers.map((user) => (
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
                  {role === "student" && user.reference && (
                    <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200/50 w-fit font-medium">
                      {locale === "bn" ? `রেফারেন্স: ${user.reference}` : `Reference: ${user.reference}`}
                    </p>
                  )}
                  {role === "teacher" && user.teacherUsage && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded border border-border bg-background px-2 py-1 font-semibold text-muted">
                        Image requests: {user.teacherUsage.imageQuestionUploadCount}
                      </span>
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                        Monthly charge: {user.teacherUsage.monthlyChargeTk} tk
                      </span>
                      <span
                        className={cn(
                          "rounded border px-2 py-1 font-bold",
                          user.teacherUsage.isChargeExpired
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-800",
                        )}
                      >
                        Start: {formatTeacherBillingDate(user.teacherUsage.chargeCycleStartedAt)}
                      </span>
                      <span
                        className={cn(
                          "rounded border px-2 py-1 font-bold",
                          user.teacherUsage.isChargeExpired
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-800",
                        )}
                      >
                        End: {formatTeacherBillingDate(user.teacherUsage.chargeDueAt)}
                      </span>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {"Joined"}:{" "}
                    {new Date(user.createdAt).toLocaleDateString(
                      "bn-BD",
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
                  {role === "teacher" && (
                    <Button
                      size="sm"
                      variant="default"
                      loading={pendingId === user.id}
                      onClick={() => updateUser(user.id, { refreshCharge: true })}
                    >
                      {"Refresh Charge"}
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
                {"এই শিক্ষক কোন কোন ক্লাস ও বিষয়ের রেজাল্ট দেখতে পারবেন তা সিলেক্ট করুন।"}
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
                    isAllDomain ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-surface"
                  )}>
                    {isAllDomain && <Check className="size-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">
                      {"সম্পূর্ণ অ্যাক্সেস (সব ক্লাস এবং বিষয়)"}
                    </p>
                    <p className="text-2xs text-muted mt-0.5 leading-relaxed">
                      {"এটি Active থাকলে এই শিক্ষক সকল ছাত্র-ছাত্রীর সকল বিষয়ের পরীক্ষার রেজাল্ট দেখতে পারবেন।"}
                    </p>
                  </div>
                </div>
              </div>

              {!isAllDomain && (
                <div className="space-y-6">
                  {/* Classes Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                      {"অনুমোদিত ক্লাস"}
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
                                isChecked ? "border-primary bg-primary text-white" : "border-border bg-surface"
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
                      {"অনুমোদিত বিষয়"}
                    </h4>
                    
                    {allowedClasses.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-surface/20 p-8 text-center flex flex-col items-center justify-center">
                        <AlertCircle className="size-8 text-muted/50 mb-2.5 animate-pulse" />
                        <p className="text-sm font-medium text-muted">
                          {"বিষয় কনফিগার করার জন্য প্রথমে উপরে ক্লাস সিলেক্ট করুন।"}
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

                  {/* Assigned Students Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                      {"অনুমোদিত শিক্ষার্থী"}
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Search inputs */}
                      <div className="flex gap-2">
                        <Input
                          placeholder={"রেফারেন্স দিয়ে ফিল্টার..."}
                          value={studentSearchRef}
                          onChange={(e) => setStudentSearchRef(e.target.value)}
                          className="flex-1 text-xs"
                        />
                        <Input
                          placeholder={"নাম বা ফোন দিয়ে ফিল্টার..."}
                          value={studentSearchName}
                          onChange={(e) => setStudentSearchName(e.target.value)}
                          className="flex-1 text-xs"
                        />
                      </div>

                      <div className="flex justify-between items-center text-2xs text-muted">
                        <span>
                          {locale === "bn" ? `${filteredStudents.length} জন শিক্ষার্থী পাওয়া গেছে` : `${filteredStudents.length} students found`}
                        </span>
                        {filteredStudents.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSelectAllFilteredStudents}
                            className="text-primary hover:text-primary-hover font-semibold text-[11px] h-auto p-0"
                          >
                            {"ফিল্টার করা সবাইকে সিলেক্ট করুন"}
                          </Button>
                        )}
                      </div>

                      <div className="max-h-[180px] overflow-y-auto rounded-xl border border-border bg-surface/30 p-2 space-y-1">
                        {filteredStudents.length === 0 ? (
                          <p className="text-xs text-center text-muted py-4">
                            {"কোনো শিক্ষার্থী পাওয়া যায়নি"}
                          </p>
                        ) : (
                          filteredStudents.map((st) => {
                            const isChecked = allowedStudents.includes(st.id);
                            return (
                              <div
                                key={st.id}
                                onClick={() => toggleStudentSelection(st.id)}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/40 cursor-pointer text-xs transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "size-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                    isChecked ? "border-primary bg-primary text-white" : "border-border bg-surface"
                                  )}>
                                    {isChecked && <Check className="size-2.5 stroke-[3]" />}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-primary">{st.name} ({getClassLabel(st.studentClass!, locale)})</p>
                                    <p className="text-2xs text-muted-foreground">{st.phone || st.email}</p>
                                  </div>
                                </div>
                                {st.reference && (
                                  <span className="text-2xs px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-800 font-medium max-w-[120px] truncate">
                                    Ref: {st.reference}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
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
                {"বাতিল"}
              </Button>
              <Button onClick={handleSaveDomain}>
                {"সংরক্ষণ করুন"}
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
