import { StudentClassAssignments } from "@/components/content/StudentClassAssignments";

export default function StudentAssignmentsPage() {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Student panel</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          CQ অ্যাসাইনমেন্ট
        </h1>
        <p className="mt-2 text-sm text-muted">
          শুধু আপনার শ্রেণির জন্য প্রকাশিত অ্যাসাইনমেন্ট।
        </p>
      </div>
      <StudentClassAssignments />
    </section>
  );
}

