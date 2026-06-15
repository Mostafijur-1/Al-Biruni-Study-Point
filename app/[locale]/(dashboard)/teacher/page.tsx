import { RoutePlaceholder } from "@/components/shared/RoutePlaceholder";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";

export default function TeacherDashboardPage() {
  return (
    <div className="space-y-6">
      <RoutePlaceholder
        eyebrow="Teacher panel"
        title="Teacher Dashboard"
        description="Class uploads, MCQ creation, CQ reviews, and student performance."
      />
      <BroadcastPanel />
    </div>
  );
}
