import { AdminOverview } from "@/components/admin/AdminOverview";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";
import { AdminAttendanceRegister } from "@/components/attendance/AdminAttendanceRegister";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <AdminOverview />
      <AdminAttendanceRegister />
      <BroadcastPanel />
    </div>
  );
}
