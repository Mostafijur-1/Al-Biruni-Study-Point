import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "absp_access_token";
export const REFRESH_COOKIE = "absp_refresh_token";
export const ROLE_COOKIE = "absp_role";

const isProduction = process.env.NODE_ENV === "production";

export const accessCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: 60 * 15,
};

export const refreshCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export const roleCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(ROLE_COOKIE);
}
