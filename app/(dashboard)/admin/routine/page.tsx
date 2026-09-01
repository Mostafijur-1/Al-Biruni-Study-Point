import type { Metadata } from "next";
import { AdminRoutinePlanner } from "@/components/routine/AdminRoutinePlanner";

export const metadata: Metadata = { title: "Routine Management | ABSP" };

export default function AdminRoutinePage() {
  return <AdminRoutinePlanner />;
}
