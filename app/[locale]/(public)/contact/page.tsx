import { ContactSection } from "@/components/contact/ContactSection";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type ContactPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  return <ContactSection locale={locale} contact={dict.contact} />;
}
