"use client";

import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { GuestAuthLinks, UserMenu } from "@/components/layout/UserMenu";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { useSession } from "@/lib/hooks/use-session";
import { getLocalizedPath, type Locale } from "@/lib/i18n";
import { publicNavPaths } from "@/lib/routes";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type NavbarProps = {
  locale: Locale;
  navigation: Dictionary["navigation"];
  auth: Dictionary["auth"];
};

export function Navbar({ locale, navigation, auth }: NavbarProps) {
  const { user: session, checking: checkingSession, setUser: setSession } = useSession({
    listenToAuthChanges: true,
  });

  return (
    <header className="sticky top-0 z-50 border-b-4 border-brand-yellow bg-primary shadow-[var(--shadow-md)]">
      <div className="mx-auto flex h-[var(--header-height)] max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 lg:px-6">
        <Logo locale={locale} size="sm" priority className="min-w-0 flex-1 sm:flex-none" />

        <nav className="hidden items-center gap-0.5 lg:flex">
          {publicNavPaths.map(({ key, path }) => (
            <Link
              key={path}
              href={getLocalizedPath(path, locale)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              {navigation[key]}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:block">
            <LocaleSwitcher
              locale={locale}
              className="border-white/25 bg-white/10 text-white hover:bg-white/15"
            />
          </div>

          <div className="hidden lg:flex lg:items-center lg:gap-2">
            {session ? (
              <UserMenu locale={locale} user={session} auth={auth} onLogout={() => setSession(null)} />
            ) : checkingSession ? (
              <div className="h-9 w-24 rounded-lg bg-white/10" aria-hidden />
            ) : (
              <GuestAuthLinks locale={locale} navigation={navigation} />
            )}
          </div>

          <MobileNav
            locale={locale}
            navigation={navigation}
            auth={auth}
            session={session}
            checkingSession={checkingSession}
            onLogout={() => setSession(null)}
          />
        </div>
      </div>
    </header>
  );
}
