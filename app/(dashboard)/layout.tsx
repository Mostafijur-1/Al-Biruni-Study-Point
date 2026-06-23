import { Suspense, type ReactNode } from "react";

import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/layout/DashboardMobileNav";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 md:grid-cols-[220px_1fr] lg:px-6 lg:py-8">
        <Suspense fallback={<aside className="hidden md:block md:w-[220px]" />}>
          <DashboardSidebar />
        </Suspense>
        <section className="min-w-0 pb-20 md:pb-0">{children}</section>
      </div>
      <Suspense fallback={null}>
        <DashboardMobileNav />
      </Suspense>
    </>
  );
}

