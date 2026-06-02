import { AdminExamsPanel } from "@/components/admin/AdminExamsPanel";
import type { Locale } from "@/lib/i18n";

type AdminExamsPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminExamsPage({ params }: AdminExamsPageProps) {
  const { locale } = await params;
  return <AdminExamsPanel locale={locale} />;
}
