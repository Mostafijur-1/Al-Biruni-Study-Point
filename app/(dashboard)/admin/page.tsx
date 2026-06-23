import { AdminOverview } from "@/components/admin/AdminOverview";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <AdminOverview />
      <BroadcastPanel />
    </div>
  );
}

