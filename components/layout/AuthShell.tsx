import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type AuthShellProps = {
    brand: Dictionary["brand"];
  auth: Dictionary["auth"];
  children: ReactNode;
};

export function AuthShell({ brand, auth, children }: AuthShellProps) {
  return (
    <div className="min-h-[calc(100vh-var(--header-height))] min-h-[calc(100dvh-var(--header-height))] lg:grid lg:grid-cols-2">
      <div
        className="relative hidden overflow-hidden px-8 py-12 text-primary-foreground xl:px-12 xl:py-14 lg:flex lg:flex-col lg:justify-between"
        style={{ background: "var(--gradient-auth)" }}
      >
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-brand-blue/20" />
        <div className="absolute -bottom-24 -left-12 size-80 rounded-full bg-brand-yellow/15" />

        <Logo size="lg" className="relative" />

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight">{auth.shell.title}</h2>
          <p className="mt-4 text-base leading-7 text-white/90">{auth.shell.subtitle}</p>
          <ul className="mt-8 space-y-3">
            {auth.shell.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-brand-yellow text-[10px] font-bold text-accent-foreground">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/65">{auth.shell.footer}</p>
      </div>

      <div className="flex flex-col">
        <div className="border-b border-border bg-secondary/40 px-4 py-4 lg:hidden">
          <Logo size="sm" tone="dynamic" className="mb-2 inline-block" />
          <p className="text-sm font-medium text-muted">{brand.tagline}</p>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
