import { AdminOverview } from "@/components/admin/AdminOverview";
import type { Locale } from "@/lib/i18n";

type AdminDashboardPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminDashboardPage({ params }: AdminDashboardPageProps) {
  const { locale } = await params;
  return <AdminOverview locale={locale} />;
}
