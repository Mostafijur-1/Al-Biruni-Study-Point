import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:grid-cols-[240px_1fr] lg:px-6">
      <Sidebar />
      <section className="min-w-0">{children}</section>
    </div>
  );
}
