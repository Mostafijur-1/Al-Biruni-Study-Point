import { TeacherMcqHub } from "@/components/exam/TeacherMcqHub";
import type { Locale } from "@/lib/i18n";

type TeacherMcqPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function TeacherMcqPage({ params }: TeacherMcqPageProps) {
  const { locale } = await params;
  return <TeacherMcqHub locale={locale} />;
}
