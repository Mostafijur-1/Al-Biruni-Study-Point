import { redirect } from "next/navigation";

import type { Locale } from "@/lib/i18n";

type LegacyCreateExamPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function LegacyCreateExamPage({ params }: LegacyCreateExamPageProps) {
  const { locale } = await params;
  redirect(`/${locale}/teacher/mcq/create`);
}
