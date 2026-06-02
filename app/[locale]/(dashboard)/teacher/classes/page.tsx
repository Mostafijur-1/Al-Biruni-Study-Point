import { TeacherClassUploadPanel } from "@/components/content/TeacherClassUploadPanel";
import type { Locale } from "@/lib/i18n";

type TeacherClassesPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function TeacherClassesPage({ params }: TeacherClassesPageProps) {
  const { locale } = await params;
  return <TeacherClassUploadPanel locale={locale} />;
}
