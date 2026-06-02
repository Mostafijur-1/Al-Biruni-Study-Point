import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import type { Locale } from "@/lib/i18n";

type AdminStudentsPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminStudentsPage({ params }: AdminStudentsPageProps) {
  const { locale } = await params;
  return <AdminUsersPanel locale={locale} role="student" />;
}
