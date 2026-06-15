import { AdminOverview } from "@/components/admin/AdminOverview";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";
import type { Locale } from "@/lib/i18n";

type AdminDashboardPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminDashboardPage({ params }: AdminDashboardPageProps) {
  const { locale } = await params;
  return (
    <div className="space-y-6">
      <AdminOverview locale={locale} />
      <BroadcastPanel />
    </div>
  );
}
