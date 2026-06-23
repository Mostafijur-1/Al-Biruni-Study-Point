"use client";

import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { GuestAuthLinks, UserMenu } from "@/components/layout/UserMenu";
import { useSession } from "@/lib/hooks/use-session";
import { getLocalizedPath } from "@/lib/i18n";
import { publicNavPaths } from "@/lib/routes";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type NavbarProps = {
    navigation: Dictionary["navigation"];
  auth: Dictionary["auth"];
};

export function Navbar({ navigation, auth }: NavbarProps) {
  const { user: session, checking: checkingSession, setUser: setSession } = useSession({
    listenToAuthChanges: true,
  });

  return (
    <header className="sticky top-0 z-50 border-b-4 border-brand-yellow bg-navy shadow-[var(--shadow-md)]">
      <div className="mx-auto flex h-[var(--header-height)] max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 lg:h-[4.75rem] lg:px-8 lg:py-2 xl:px-10">
        <Logo size="md" className="min-w-0 flex-1 sm:flex-none" />

        <nav className="hidden items-center gap-0.5 lg:flex">
          {publicNavPaths.map(({ key, path }) => (
            <Link
              key={path}
              href={getLocalizedPath(path)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              {navigation[key]}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            {session ? (
              <UserMenu user={session} auth={auth} onLogout={() => setSession(null)} />
            ) : checkingSession ? (
              <div className="h-9 w-24 rounded-lg bg-white/10" aria-hidden />
            ) : (
              <GuestAuthLinks navigation={navigation} />
            )}
          </div>

          <MobileNav
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
