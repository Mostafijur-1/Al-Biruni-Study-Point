import type { Metadata } from "next";
import { AdminRoutinePlanner } from "@/components/routine/AdminRoutinePlanner";

export const metadata: Metadata = { title: "রুটিন ব্যবস্থাপনা | ABSP" };

export default function AdminRoutinePage() {
  return <AdminRoutinePlanner />;
}
