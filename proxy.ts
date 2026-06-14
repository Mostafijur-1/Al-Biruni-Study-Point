import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, ROLE_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { locales, type Locale, parseLocalizedPath, getLocalizedPath } from "@/lib/i18n";
import type { UserRole } from "@/types";

const protectedPrefixes: Record<UserRole, string> = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // 1. Parse the locale and path without locale from the request path.
  const { locale, pathWithoutLocale } = parseLocalizedPath(pathname);

  // 2. If the user explicitly typed "/bn", "/bn/", "/bn/about", etc.
  // We want to redirect them to the clean path (no "/bn" prefix)
  const isExplicitBn = pathname.startsWith("/bn") && (pathname.length === 3 || pathname[3] === "/");
  if (isExplicitBn) {
    const cleanPath = pathname.substring(3) || "/";
    const url = new URL(`${cleanPath}${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(url, 301); // 301 Permanent Redirect
  }

  // 3. For role protection check, we match the prefix on pathWithoutLocale.
  const matchedRole = Object.entries(protectedPrefixes).find(([, prefix]) =>
    pathWithoutLocale.startsWith(prefix),
  )?.[0] as UserRole | undefined;

  if (!matchedRole) {
    // If not protected, and not explicit bn (handled above),
    // and it is English, we don't rewrite because Next.js handles it natively at /en/...
    // But if it is Bangla (locale = 'bn'), we must rewrite internally to /bn/...
    // because all pages are structured inside app/[locale].
    if (locale === "bn") {
      const url = new URL(`/bn${pathname}${request.nextUrl.search}`, request.url);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Auth/Role protection logic:
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value as UserRole | undefined;

  const redirectToLogin = () => {
    const loginUrl = new URL(getLocalizedPath("/login", locale), request.url);
    const returnPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", returnPath);
    loginUrl.searchParams.set("reason", "access");
    return NextResponse.redirect(loginUrl);
  };

  if (matchedRole === "student" && !accessToken) {
    const isGuestAllowed =
      pathWithoutLocale === "/student" ||
      pathWithoutLocale === "/student/courses" ||
      pathWithoutLocale === "/student/practice" ||
      pathWithoutLocale.startsWith("/student/practice/");
    if (isGuestAllowed) {
      if (locale === "bn") {
        const url = new URL(`/bn${pathname}${request.nextUrl.search}`, request.url);
        return NextResponse.rewrite(url);
      }
      return NextResponse.next();
    }
  }

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

  // If role is authorized:
  if (locale === "bn") {
    const url = new URL(`/bn${pathname}${request.nextUrl.search}`, request.url);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
