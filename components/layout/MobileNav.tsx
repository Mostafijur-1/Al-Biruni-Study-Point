"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { GuestAuthLinks, UserMenu } from "@/components/layout/UserMenu";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { getLocalizedPath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { publicNavPaths } from "@/lib/routes";
import type { SessionUser } from "@/types";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  locale: Locale;
  navigation: Dictionary["navigation"];
  auth: Dictionary["auth"];
  session: SessionUser | null;
  checkingSession: boolean;
  onLogout: () => void;
};

export function MobileNav({
  locale,
  navigation,
  auth,
  session,
  checkingSession,
  onLogout,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOpen(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-lg border border-border bg-surface text-primary"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-primary pt-[var(--header-height)] lg:hidden">
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <nav className="space-y-1">
              {publicNavPaths.map(({ key, path }) => {
                const href = getLocalizedPath(path, locale);
                const active = pathname === href;

                return (
                  <Link
                    key={path}
                    href={href}
                    className={cn(
                      "block rounded-xl px-4 py-3.5 text-base font-semibold transition",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-white/90 hover:bg-white/10",
                    )}
                  >
                    {navigation[key]}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-6">
              <LocaleSwitcher locale={locale} className="border-white/25 text-white hover:bg-white/10" />
            </div>

            <div className="mt-6 space-y-3 border-t border-white/15 pt-6">
              {session ? (
                <UserMenu
                  locale={locale}
                  user={session}
                  auth={auth}
                  onLogout={onLogout}
                  mobile
                />
              ) : checkingSession ? (
                <div className="h-11 rounded-lg bg-white/10" aria-hidden />
              ) : (
                <div className="flex flex-col gap-2">
                  <GuestAuthLinks locale={locale} navigation={navigation} mobile />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
