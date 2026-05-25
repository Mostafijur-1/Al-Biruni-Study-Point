"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { locales, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const pathname = usePathname();
  const otherLocale = locales.find((item) => item !== locale) ?? "en";
  const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";
  const href = `/${otherLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary transition hover:bg-secondary",
        className,
      )}
      hrefLang={otherLocale}
    >
      {otherLocale === "bn" ? "বাংলা" : "EN"}
    </Link>
  );
}
