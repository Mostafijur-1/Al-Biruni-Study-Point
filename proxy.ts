import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, ROLE_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { defaultLocale, locales, type Locale } from "@/lib/i18n";
import type { UserRole } from "@/types";

const protectedPrefixes: Record<UserRole, string> = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
};

function getLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];
  return locales.includes(segment as Locale) ? (segment as Locale) : null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const locale = getLocale(pathname);
  if (!locale) {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url));
  }

  const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";
  const matchedRole = Object.entries(protectedPrefixes).find(([, prefix]) =>
    pathWithoutLocale.startsWith(prefix),
  )?.[0] as UserRole | undefined;

  if (!matchedRole) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value as UserRole | undefined;

  const redirectToLogin = () => {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    const returnPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", returnPath);
    loginUrl.searchParams.set("reason", "access");
    return NextResponse.redirect(loginUrl);
  };

  if (!accessToken || role !== matchedRole) {
    return redirectToLogin();
  }

  try {
    const payload = verifyAccessToken(accessToken);

    if (payload.role !== matchedRole) {
      return redirectToLogin();
    }
  } catch {
    return redirectToLogin();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
