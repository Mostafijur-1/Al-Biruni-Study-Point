import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { formatPhoneDisplay, phoneTelHref } from "@/lib/format/phone";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type FooterProps = {
  locale: Locale;
  brand: Dictionary["brand"];
  footer: Dictionary["footer"];
  navigation: Dictionary["navigation"];
  contact: Dictionary["contact"];
};

export function Footer({ locale, brand, footer, navigation, contact }: FooterProps) {
  const path = createLocalizedPath(locale);

  return (
    <footer className="mt-auto border-t-4 border-brand-yellow bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Logo locale={locale} size="md" />
            <p className="mt-3 text-sm leading-6 text-white/80">{brand.tagline}</p>
          </div>

          <nav className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-semibold sm:flex sm:flex-col sm:gap-3">
            <p className="col-span-2 text-xs font-bold uppercase tracking-widest text-brand-yellow sm:col-span-1">
              {footer.quickLinks}
            </p>
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

          <div className="space-y-4 text-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
              {contact.addressTitle}
            </p>

            <div className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-yellow" aria-hidden />
              <address className="space-y-0.5 not-italic leading-6 text-white/85">
                {contact.addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </address>
            </div>

            <div className="flex gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-brand-yellow" aria-hidden />
              <ul className="space-y-1">
                {contact.phones.map((phone) => (
                  <li key={phone}>
                    <a
                      href={phoneTelHref(phone)}
                      className="font-semibold text-white/90 transition hover:text-brand-yellow"
                    >
                      {formatPhoneDisplay(phone)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand-yellow" aria-hidden />
              <a
                href={`mailto:${contact.email}`}
                className="break-all font-semibold text-white/90 transition hover:text-brand-yellow"
              >
                {contact.email}
              </a>
            </div>

            <p className="text-xs text-white/65">
              {contact.hoursTitle}: {contact.hours}
            </p>
          </div>
        </div>

        <p className="mt-8 border-t border-white/15 pt-6 text-center text-xs text-white/65 sm:text-left">
          {footer.rights}
        </p>
      </div>
    </footer>
  );
}
