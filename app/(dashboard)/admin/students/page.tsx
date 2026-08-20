import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { CoachingEnrollmentPanel } from "@/components/coaching/CoachingEnrollmentPanel";

export default function AdminStudentsPage() {
  return <div className="space-y-10"><CoachingEnrollmentPanel /><div className="border-t border-border pt-8"><AdminUsersPanel role="student" /></div></div>;
}
