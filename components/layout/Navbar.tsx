import Link from "next/link";

import { getLocalizedPath, type Locale } from "@/lib/i18n";
import { publicRoutes } from "@/lib/routes";

export function Navbar({ locale }: { locale: Locale }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
        <Link href={getLocalizedPath("/", locale)} className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded bg-primary text-sm font-bold text-primary-foreground">
            AB
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-primary">ABSP</span>
            <span className="block text-xs text-muted">Al-Biruni Study Point</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          {publicRoutes.slice(1, 5).map((route) => (
            <Link key={route.path} href={getLocalizedPath(route.path, locale)} className="hover:text-primary">
              {route.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={getLocalizedPath("/login", locale)}
            className="rounded border border-border px-3 py-2 text-sm font-semibold text-primary"
          >
            Login
          </Link>
          <Link
            href={getLocalizedPath("/register", locale)}
            className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
