"use client";

import { formatClassList } from "@/lib/content/classes";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StudentClass } from "@/types";

type AdminCourseRow = {
  _id: string;
  title: string;
  titleBn?: string;
  subject: string;
  level: string;
  status: string;
  targetClasses: StudentClass[];
  teacher: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
    approvalStatus?: string;
  } | null;
  studentCount: number;
  examCount: number;
};

export function AdminCoursesPanel() {
  const locale = "bn";
      const { data, message, isLoading } = useApiQuery<{ courses: AdminCourseRow[] }>("/api/admin/courses", {
    loadingMessage: "লোড হচ্ছে...",
    errorMessage: "কোর্স লোড করা যায়নি।",
  });

  const courses = data?.courses ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {"কোর্স পরিচালনা"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {"প্রতিটি কোর্সের শিক্ষক, লক্ষ্য শ্রেণি ও সম্পর্কিত শিক্ষার্থী দেখুন।"}
        </p>
      </div>

      {isLoading ? (
        <ul className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <li key={i} className="rounded-xl border border-border bg-card/45 p-4 space-y-4 shadow-[var(--shadow-sm)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-48 rounded bg-secondary animate-pulse" />
                    <div className="h-5 w-16 rounded-full bg-secondary animate-pulse" />
                  </div>
                  <div className="h-4 w-32 rounded bg-secondary animate-pulse" />
                  <div className="h-3.5 w-24 rounded bg-secondary animate-pulse" />
                  <div className="h-4 w-40 rounded bg-secondary animate-pulse mt-2" />
                </div>
                <div className="flex gap-4">
                  <div className="space-y-1">
                    <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
                    <div className="h-6 w-8 rounded bg-secondary animate-pulse" />
                    <div className="h-3 w-20 rounded bg-secondary animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 w-12 rounded bg-secondary animate-pulse" />
                    <div className="h-6 w-8 rounded bg-secondary animate-pulse" />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : message ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">{message}</p>
      ) : courses.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          {"কোনো কোর্স নেই।"}
        </p>
      ) : (
        <ul className="space-y-3">
          {courses.map((course) => (
            <li
              key={course._id}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-primary">
                      {course.titleBn ? course.titleBn : course.title}
                    </h2>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        course.status === "published"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-secondary text-muted",
                      )}
                    >
                      {course.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {course.subject} · {course.level}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatClassList(course.targetClasses, locale)}
                  </p>
                  {course.teacher && (
                    <p className="mt-2 text-sm text-primary">
                      {"শিক্ষক"}:{" "}
                      <span className="font-semibold">{course.teacher.name}</span>
                      {course.teacher.phone && (
                        <span className="text-muted"> · {course.teacher.phone}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="text-xs font-bold uppercase text-accent">
                      {"শিক্ষার্থী"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-primary">{course.studentCount}</p>
                    <p className="text-xs text-muted">
                      {"লক্ষ্য শ্রেণিতে"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-accent">
                      {"অনুশীলন প্রশ্ন"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-primary">{course.examCount}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
