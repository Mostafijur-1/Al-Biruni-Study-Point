import { StudentClassAssignments } from "@/components/content/StudentClassAssignments";
import type { Locale } from "@/lib/i18n";

type StudentAssignmentsPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function StudentAssignmentsPage({ params }: StudentAssignmentsPageProps) {
  const { locale } = await params;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Student panel</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          {locale === "bn" ? "CQ অ্যাসাইনমেন্ট" : "CQ assignments"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {locale === "bn"
            ? "শুধু আপনার শ্রেণির জন্য প্রকাশিত অ্যাসাইনমেন্ট।"
            : "Published assignments for your class only."}
        </p>
      </div>
      <StudentClassAssignments locale={locale} />
    </section>
  );
}
