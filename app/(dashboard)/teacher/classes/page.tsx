import Link from "next/link";

import { TeacherClassUploadPanel } from "@/components/content/TeacherClassUploadPanel";
import { TimetableWorkspace } from "@/components/TimetableWorkspace";

type TeacherClassesPageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function TeacherClassesPage({ searchParams }: TeacherClassesPageProps) {
  const { view } = await searchParams;

  if (view === "content") {
    return (
      <div className="space-y-4">
        <Link
          href="/teacher/classes"
          className="inline-flex min-h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-bold text-primary hover:bg-secondary"
        >
          ← ক্লাস রুটিনে ফিরুন
        </Link>
        <TeacherClassUploadPanel />
      </div>
    );
  }

  return <TimetableWorkspace role="teacher" />;
}
