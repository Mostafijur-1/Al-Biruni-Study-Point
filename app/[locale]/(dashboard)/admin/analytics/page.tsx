import { AdminOverview } from "@/components/admin/AdminOverview";
import type { Locale } from "@/lib/i18n";

type AdminAnalyticsPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminAnalyticsPage({ params }: AdminAnalyticsPageProps) {
  const { locale } = await params;
  return <AdminOverview locale={locale} />;
}
