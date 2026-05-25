import { HomeSection } from "@/components/home/HomeSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const dict = getDictionary(locale as Locale);

  return <HomeSection locale={locale as Locale} dict={dict.home} brand={dict.brand} />;
}
