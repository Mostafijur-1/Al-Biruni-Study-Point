import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const resolvedLocale = locale as Locale;
  const dict = getDictionary(resolvedLocale);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar locale={resolvedLocale} navigation={dict.navigation} auth={dict.auth} />
      <main className="flex-1">{children}</main>
      <Footer
        locale={resolvedLocale}
        brand={dict.brand}
        footer={dict.footer}
        navigation={dict.navigation}
        contact={dict.contact}
      />
    </div>
  );
}
