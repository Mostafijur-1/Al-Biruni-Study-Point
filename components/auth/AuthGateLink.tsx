"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useSession } from "@/lib/hooks/use-session";
import { buildLoginUrl, buildRegisterUrl } from "@/lib/auth/return-url";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AuthGateLinkProps = {
  locale: Locale;
  href: string;
  returnUrl: string;
  className?: string;
  children: ReactNode;
};

export function AuthGateLink({ locale, href, returnUrl, className, children }: AuthGateLinkProps) {
  const router = useRouter();
  const { user, checking } = useSession({ listenToAuthChanges: true });

  if (checking) {
    return (
      <span className={cn(className, "pointer-events-none opacity-60")} aria-busy="true">
        {children}
      </span>
    );
  }

  if (user?.role === "student") {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={buildLoginUrl(locale, returnUrl, "access")}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        router.push(buildLoginUrl(locale, returnUrl, "access"));
      }}
    >
      {children}
    </Link>
  );
}

export function AuthGateRegisterLink({
  locale,
  returnUrl,
  className,
  children,
}: Omit<AuthGateLinkProps, "href">) {
  return (
    <Link href={buildRegisterUrl(locale, returnUrl)} className={className}>
      {children}
    </Link>
  );
}
