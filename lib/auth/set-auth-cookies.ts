import type { NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  accessCookieOptions,
  REFRESH_COOKIE,
  refreshCookieOptions,
  ROLE_COOKIE,
  roleCookieOptions,
} from "@/lib/auth/cookies";
import type { UserRole } from "@/types";

export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
  role: UserRole,
) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions);
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
  response.cookies.set(ROLE_COOKIE, role, roleCookieOptions);
}
