"use client";

import { useApiQuery } from "@/lib/hooks/use-api-query";
import { formatClassList } from "@/lib/content/classes";
import type { Locale } from "@/lib/i18n";
import type { StudentClass } from "@/types";

type AssignmentRow = {
  _id: string;
  title: string;
  description?: string;
  totalMarks: number;
  dueDate?: string;
  targetClasses: StudentClass[];
};

export function StudentClassAssignments({ locale }: { locale: Locale }) {
  const { data, message } = useApiQuery<{ assignments: AssignmentRow[] }>(
    "/api/cq/assignments?scope=student",
    {
      loadingMessage: locale === "bn" ? "অ্যাসাইনমেন্ট লোড হচ্ছে..." : "Loading assignments...",
      errorMessage: locale === "bn" ? "অ্যাসাইনমেন্ট লোড করা যায়নি।" : "Could not load assignments.",
    },
  );

  const assignments = data?.assignments ?? [];

  return (
    <div className="space-y-4">
      {message ? (
        <p className="text-sm text-muted">{message}</p>
      ) : assignments.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          {locale === "bn"
            ? "আপনার শ্রেণির জন্য এখনও কোনো CQ অ্যাসাইনমেন্ট নেই।"
            : "No CQ assignments are available for your class yet."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {assignments.map((assignment) => (
            <li key={assignment._id} className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-primary">{assignment.title}</p>
              {assignment.description && (
                <p className="mt-1 text-sm text-muted">{assignment.description}</p>
              )}
              <p className="mt-2 text-xs text-muted">
                {locale === "bn" ? "নম্বর" : "Marks"}: {assignment.totalMarks}
                {assignment.dueDate && (
                  <>
                    {" "}
                    · {locale === "bn" ? "শেষ তারিখ" : "Due"}:{" "}
                    {new Date(assignment.dueDate).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US")}
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatClassList(assignment.targetClasses, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
