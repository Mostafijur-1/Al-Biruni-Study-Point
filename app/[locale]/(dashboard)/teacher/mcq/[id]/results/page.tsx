import { TeacherMcqResults } from "@/components/exam/TeacherMcqResults";
import type { Locale } from "@/lib/i18n";

type McqResultsPageProps = {
  params: Promise<{ locale: Locale; id: string }>;
};

export default async function McqResultsPage({ params }: McqResultsPageProps) {
  const { locale, id } = await params;
  return <TeacherMcqResults locale={locale} examId={id} />;
}
