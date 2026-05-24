import type { Locale } from "@/lib/i18n";

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between lg:px-6">
        <p>ABSP - Al-Biruni Study Point</p>
        <p>Bangla-first LMS foundation. Active locale: {locale}</p>
      </div>
    </footer>
  );
}
