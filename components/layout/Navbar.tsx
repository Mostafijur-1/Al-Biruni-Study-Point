"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { GuestAuthLinks, UserMenu } from "@/components/layout/UserMenu";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { getLocalizedPath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SessionUser } from "@/types";

const navPaths = [
  { key: "home" as const, path: "/" },
  { key: "about" as const, path: "/about" },
  { key: "courses" as const, path: "/courses" },
  { key: "batches" as const, path: "/batches" },
  { key: "contact" as const, path: "/contact" },
];

type NavbarProps = {
  locale: Locale;
  navigation: Dictionary["navigation"];
  auth: Dictionary["auth"];
};

type MeResponse = {
  success: boolean;
  data?: { user: SessionUser };
};

export function Navbar({ locale, navigation, auth }: NavbarProps) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (active) setCheckingSession(true);

      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          if (active) setSession(null);
          return;
        }
        const payload = (await response.json()) as MeResponse;
        if (active && payload.success && payload.data?.user) {
          setSession(payload.data.user);
        }
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    loadSession();
    window.addEventListener("absp-auth-changed", loadSession);
    return () => {
      active = false;
      window.removeEventListener("absp-auth-changed", loadSession);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b-4 border-brand-yellow bg-primary shadow-[var(--shadow-md)]">
      <div className="mx-auto flex h-[var(--header-height)] max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 lg:px-6">
        <Logo locale={locale} size="sm" priority className="min-w-0 flex-1 sm:flex-none" />

        <nav className="hidden items-center gap-0.5 lg:flex">
          {navPaths.map(({ key, path }) => (
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
