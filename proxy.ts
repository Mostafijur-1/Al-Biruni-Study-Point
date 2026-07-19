import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE, ROLE_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
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

  // 1. Permanent redirect for legacy /bn prefix requests
  if (pathname.startsWith("/bn") && (pathname.length === 3 || pathname[3] === "/")) {
    const cleanPath = pathname.substring(3) || "/";
    const url = new URL(`${cleanPath}${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(url, 301);
  }

  // 2. Identify if request matches any protected prefixes
  const matchedRole = Object.entries(protectedPrefixes).find(([, prefix]) =>
    pathname.startsWith(prefix),
  )?.[0] as UserRole | undefined;

  if (!matchedRole) {
    return NextResponse.next();
  }

  // 3. Authenticate and authorize protected paths
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value as UserRole | undefined;

  const redirectToLogin = () => {
    const loginUrl = new URL("/login", request.url);
    const returnPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", returnPath);
    loginUrl.searchParams.set("reason", "access");
    return NextResponse.redirect(loginUrl);
  };

  const refreshAndReturn = () => {
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    refreshUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(refreshUrl);
  };

  // Student guest access allowance logic
  if (matchedRole === "student" && !accessToken) {
    const isGuestAllowed =
      pathname === "/student" ||
      pathname === "/student/courses" ||
      pathname === "/student/practice" ||
      pathname.startsWith("/student/practice/");
    if (isGuestAllowed) {
      return NextResponse.next();
    }
  }

  if (role !== matchedRole) {
    return redirectToLogin();
  }

  if (!accessToken) {
    return refreshToken ? refreshAndReturn() : redirectToLogin();
  }

  try {
    const payload = verifyAccessToken(accessToken);

    if (payload.role !== matchedRole) {
      return redirectToLogin();
    }
  } catch {
    return refreshToken ? refreshAndReturn() : redirectToLogin();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
