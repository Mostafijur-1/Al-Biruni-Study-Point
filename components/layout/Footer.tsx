import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { getLocalizedPath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type FooterProps = {
  locale: Locale;
  brand: Dictionary["brand"];
  footer: Dictionary["footer"];
  navigation: Dictionary["navigation"];
};

export function Footer({ locale, brand, footer, navigation }: FooterProps) {
  const path = (p: string) => getLocalizedPath(p, locale);

  return (
    <footer className="mt-auto border-t-4 border-brand-yellow bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Logo locale={locale} size="md" />
            <p className="mt-3 text-sm leading-6 text-white/80">{brand.tagline}</p>
          </div>
          <nav className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-semibold sm:flex sm:flex-wrap sm:gap-x-8">
            <Link href={path("/about")} className="text-white/90 transition hover:text-brand-yellow">
              {navigation.about}
            </Link>
            <Link href={path("/courses")} className="text-white/90 transition hover:text-brand-yellow">
              {navigation.courses}
            </Link>
            <Link href={path("/batches")} className="text-white/90 transition hover:text-brand-yellow">
              {navigation.batches}
            </Link>
            <Link href={path("/contact")} className="text-white/90 transition hover:text-brand-yellow">
              {navigation.contact}
            </Link>
            <Link href={path("/login")} className="text-white/90 transition hover:text-brand-yellow">
              {navigation.login}
            </Link>
            <Link href={path("/register")} className="text-brand-yellow transition hover:text-white">
              {navigation.register}
            </Link>
          </nav>
        </div>
        <p className="mt-8 border-t border-white/15 pt-6 text-center text-xs text-white/65 sm:text-left">
          {footer.rights}
        </p>
      </div>
    </footer>
  );
}
