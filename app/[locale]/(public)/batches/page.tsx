import { BatchesList } from "@/components/batches/BatchesList";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type BatchesPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function BatchesPage({ params }: BatchesPageProps) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  return <BatchesList locale={locale} dict={dict.home.batches} />;
}
