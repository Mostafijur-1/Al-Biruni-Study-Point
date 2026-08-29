import { AdminAttendanceRegister } from "@/components/attendance/AdminAttendanceRegister";

export default function AdminAttendancePage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Academic records</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-primary sm:text-3xl">Attendance</h1>
        <p className="mt-2 text-sm text-muted">Review submitted attendance across every batch and class.</p>
      </header>
      <AdminAttendanceRegister />
    </div>
  );
}
