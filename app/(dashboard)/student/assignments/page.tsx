import { StudentClassAssignments } from "@/components/content/StudentClassAssignments";
import { PageHeader } from "@/components/shared/PageHeader";

export default function StudentAssignmentsPage() {
  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="শিক্ষার্থী"
        title="CQ অ্যাসাইনমেন্ট"
        description="শুধু তোমার শ্রেণির জন্য প্রকাশিত অ্যাসাইনমেন্ট।"
      />
      <StudentClassAssignments />
    </section>
  );
}
