import { McqExamBuilder } from "@/components/exam/McqExamBuilder";
import type { Locale } from "@/lib/i18n";

type CreateMcqPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function CreateMcqPage({ params }: CreateMcqPageProps) {
  const { locale } = await params;
  return <McqExamBuilder locale={locale} />;
}
