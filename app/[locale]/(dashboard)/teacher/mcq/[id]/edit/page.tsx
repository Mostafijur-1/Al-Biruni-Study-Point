import { McqExamBuilder } from "@/components/exam/McqExamBuilder";
import type { Locale } from "@/lib/i18n";

type EditMcqPageProps = {
  params: Promise<{ locale: Locale; id: string }>;
};

export default async function EditMcqPage({ params }: EditMcqPageProps) {
  const { locale, id } = await params;
  return <McqExamBuilder locale={locale} examId={id} />;
}
