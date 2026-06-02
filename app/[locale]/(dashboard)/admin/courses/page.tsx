import { AdminCoursesPanel } from "@/components/admin/AdminCoursesPanel";
import type { Locale } from "@/lib/i18n";

type AdminCoursesPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminCoursesPage({ params }: AdminCoursesPageProps) {
  const { locale } = await params;
  return <AdminCoursesPanel locale={locale} />;
}
