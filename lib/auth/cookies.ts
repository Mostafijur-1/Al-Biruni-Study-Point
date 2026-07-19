import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "absp_access_token";
export const REFRESH_COOKIE = "absp_refresh_token";
export const ROLE_COOKIE = "absp_role";

const isProduction = process.env.NODE_ENV === "production";

function durationInSeconds(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const match = /^(\d+)(s|m|h|d|y)$/i.exec(value.trim());
  if (!match) return fallback;

  const amount = Number(match[1]);
  const unitSeconds = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    y: 60 * 60 * 24 * 365,
  } as const;

  return amount * unitSeconds[match[2].toLowerCase() as keyof typeof unitSeconds];
}

const accessMaxAge = durationInSeconds(process.env.JWT_ACCESS_EXPIRES, 60 * 15);
const refreshMaxAge = durationInSeconds(process.env.JWT_REFRESH_EXPIRES, 60 * 60 * 24 * 30);

export const accessCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: accessMaxAge,
};

export const refreshCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: refreshMaxAge,
};

export const roleCookieOptions: Partial<ResponseCookie> = {
  httpOnly: false,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: refreshMaxAge,
};

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(ROLE_COOKIE);
}
