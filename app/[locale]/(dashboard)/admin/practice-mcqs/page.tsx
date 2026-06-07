import { AdminPracticeManager } from "@/components/admin/AdminPracticeManager";
import type { Locale } from "@/lib/i18n";

type AdminPracticeMcqsPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminPracticeMcqsPage({
  params,
}: AdminPracticeMcqsPageProps) {
  const { locale } = await params;

  return <AdminPracticeManager locale={locale} />;
}
