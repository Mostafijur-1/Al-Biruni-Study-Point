import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import type { Locale } from "@/lib/i18n";

type AdminTeachersPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminTeachersPage({ params }: AdminTeachersPageProps) {
  const { locale } = await params;
  return <AdminUsersPanel locale={locale} role="teacher" />;
}
