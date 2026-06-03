"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthGateLink } from "@/components/auth/AuthGateLink";
import { getClassLabel, STUDENT_CLASSES } from "@/lib/content/classes";
import { pressableClasses } from "@/components/ui/button-variants";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { guestApiQuery } from "@/lib/content/guest-scope";
import { useSession } from "@/lib/hooks/use-session";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import { formatMcqExamMeta } from "@/lib/mcq/format";
import { cn } from "@/lib/utils";
import type { StudentClass } from "@/types";
import type { McqExamSummary } from "@/types/mcq";

type GuestExploreHubProps = {
  locale: Locale;
  copy: {
    eyebrow: string;
    title: string;
    subtitle: string;
    guestHint: string;
    tabs: { exams: string; courses: string; assignments: string };
    startExam: string;
    watchVideo: string;
    viewCourses: string;
    openAssignments: string;
    loginToAccess: string;
    emptyExams: string;
    emptyCourses: string;
    emptyVideos: string;
    emptyAssignments: string;
    loading: string;
  };
};

type CourseRow = {
  _id: string;
  title: string;
  titleBn?: string;
  subject: string;
  level: string;
};

type VideoRow = {
  _id: string;
  title: string;
  description?: string;
  videoUrl: string;
};

type AssignmentRow = {
  _id: string;
  title: string;
  description?: string;
  totalMarks: number;
};

type TabId = "exams" | "courses" | "assignments";

function parseClass(value: string | null): StudentClass {
  if (value && STUDENT_CLASSES.includes(value as StudentClass)) {
    return value as StudentClass;
  }

  return "class-9";
}

function parseTab(value: string | null): TabId {
  if (value === "courses" || value === "assignments") {
    return value;
  }

  return "exams";
}

export function GuestExploreHub({ locale, copy }: GuestExploreHubProps) {
  const path = createLocalizedPath(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession({ listenToAuthChanges: true });

  const [selectedClass, setSelectedClass] = useState<StudentClass>(() =>
    parseClass(searchParams.get("class")),
  );
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTab(searchParams.get("tab")));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [exams, setExams] = useState<McqExamSummary[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const explorePath = useMemo(
    () => path(`/explore?class=${selectedClass}&tab=${activeTab}`),
    [path, selectedClass, activeTab],
  );

  const syncUrl = useCallback(
    (studentClass: StudentClass, tab: TabId) => {
      router.replace(path(`/explore?class=${studentClass}&tab=${tab}`), { scroll: false });
    },
    [path, router],
  );

  const loadContent = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    const query = guestApiQuery(selectedClass);

    const [examsRes, coursesRes, videosRes, assignmentsRes] = await Promise.all([
      apiFetch<{ exams: McqExamSummary[] }>(`/api/mcq/exams?${query}`),
      apiFetch<{ courses: CourseRow[] }>(`/api/courses?${query}`),
      apiFetch<{ videos: VideoRow[] }>(`/api/videos?${query}`),
      apiFetch<{ assignments: AssignmentRow[] }>(`/api/cq/assignments?${query}`),
    ]);

    if (!examsRes.ok || !isApiSuccess(examsRes.payload)) {
      setMessage(getApiErrorMessage(examsRes.payload, "Could not load content."));
      setLoading(false);
      return;
    }

    setExams(examsRes.payload.data.exams);
    setCourses(coursesRes.ok && isApiSuccess(coursesRes.payload) ? coursesRes.payload.data.courses : []);
    setVideos(videosRes.ok && isApiSuccess(videosRes.payload) ? videosRes.payload.data.videos : []);
    setAssignments(
      assignmentsRes.ok && isApiSuccess(assignmentsRes.payload)
        ? assignmentsRes.payload.data.assignments
        : [],
    );
    setLoading(false);
  }, [selectedClass]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadContent().catch(() => {
        setMessage("Could not load content.");
        setLoading(false);
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadContent]);

  function onClassChange(studentClass: StudentClass) {
    setSelectedClass(studentClass);
    syncUrl(studentClass, activeTab);
  }

  function onTabChange(tab: TabId) {
    setActiveTab(tab);
    syncUrl(selectedClass, tab);
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "exams", label: copy.tabs.exams },
    { id: "courses", label: copy.tabs.courses },
    { id: "assignments", label: copy.tabs.assignments },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4 sm:py-12 lg:px-6 lg:py-16">
      <div className="rounded-xl border border-border border-t-4 border-t-brand-yellow bg-card p-4 shadow-[var(--shadow-sm)] sm:p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{copy.eyebrow}</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl md:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted sm:text-lg">{copy.subtitle}</p>
        
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
        <p className="text-sm font-semibold">
          {locale === "bn" ? "শ্রেণি নির্বাচন করুন" : "Select a class"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {locale === "bn"
            ? "যেকোনো শ্রেণির কন্টেন্ট দেখুন। অ্যাক্সেস করতে রেজিস্টার/লগইন করুন।"
            : "Browse any class. Register or log in to access content."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STUDENT_CLASSES.map((studentClass) => (
            <button
              key={studentClass}
              type="button"
              onClick={() => onClassChange(studentClass)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-semibold transition",
                selectedClass === studentClass
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted hover:border-primary/40",
              )}
            >
              {getClassLabel(studentClass, locale)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-surface text-muted hover:border-primary/40",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted">{message}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted">{copy.loading}</p>
      ) : (
        <div className="mt-6">
          {activeTab === "exams" && (
            <div className="grid gap-3">
              {exams.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{copy.emptyExams}</p>
              ) : (
                exams.map((exam) => {
                  const examHref = path(`/student/exams/${exam._id}`);
                  const action = (
                    <span
                      className={cn(
                        pressableClasses,
                        "rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover",
                      )}
                    >
                      {copy.startExam}
                    </span>
                  );

                  return (
                    <article
                      key={exam._id}
                      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h2 className="text-lg font-bold text-primary">{exam.title}</h2>
                        <p className="mt-1 text-sm text-muted">{formatMcqExamMeta(exam, "minutes")}</p>
                      </div>
                      {user?.role === "student" ? (
                        <a href={examHref} className="shrink-0">
                          {action}
                        </a>
                      ) : (
                        <AuthGateLink
                          locale={locale}
                          href={examHref}
                          returnUrl={examHref}
                          className="shrink-0"
                        >
                          {action}
                        </AuthGateLink>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "courses" && (
            <div className="space-y-8">
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-primary">
                  {locale === "bn" ? "কোর্স" : "Courses"}
                </h2>
                {courses.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{copy.emptyCourses}</p>
                ) : (
                  <ul className="grid gap-3">
                    {courses.map((course) => (
                      <li key={course._id} className="rounded-xl border border-border bg-card p-4">
                        <p className="font-semibold text-primary">
                          {locale === "bn" && course.titleBn ? course.titleBn : course.title}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {course.subject} · {course.level}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-primary">
                  {locale === "bn" ? "ক্লাস ভিডিও" : "Class videos"}
                </h2>
                {videos.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{copy.emptyVideos}</p>
                ) : (
                  <ul className="grid gap-3">
                    {videos.map((video) => {
                      const returnUrl = explorePath;
                      const action = (
                        <span
                          className={cn(
                            pressableClasses,
                            "inline-block text-sm font-semibold text-brand-red hover:underline",
                          )}
                        >
                          {copy.watchVideo}
                        </span>
                      );

                      return (
                        <li key={video._id} className="rounded-xl border border-border bg-card p-4">
                          <p className="font-semibold text-primary">{video.title}</p>
                          {video.description && (
                            <p className="mt-1 text-sm text-muted">{video.description}</p>
                          )}
                          {user?.role === "student" ? (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block"
                            >
                              {action}
                            </a>
                          ) : (
                            <div className="mt-2">
                              <AuthGateLink
                                locale={locale}
                                href={path("/student/courses")}
                                returnUrl={returnUrl}
                              >
                                {action}
                              </AuthGateLink>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {activeTab === "assignments" && (
            <div className="grid gap-3">
              {assignments.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
                  {copy.emptyAssignments}
                </p>
              ) : (
                assignments.map((assignment) => {
                  const assignmentsHref = path("/student/assignments");
                  const action = (
                    <span
                      className={cn(
                        pressableClasses,
                        "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary",
                      )}
                    >
                      {copy.openAssignments}
                    </span>
                  );

                  return (
                    <article
                      key={assignment._id}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h2 className="font-semibold text-primary">{assignment.title}</h2>
                        {assignment.description && (
                          <p className="mt-1 text-sm text-muted">{assignment.description}</p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          {locale === "bn" ? "নম্বর" : "Marks"}: {assignment.totalMarks}
                        </p>
                      </div>
                      {user?.role === "student" ? (
                        <a href={assignmentsHref}>{action}</a>
                      ) : (
                        <AuthGateLink
                          locale={locale}
                          href={assignmentsHref}
                          returnUrl={assignmentsHref}
                        >
                          {action}
                        </AuthGateLink>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
