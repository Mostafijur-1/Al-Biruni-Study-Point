import type { NextRequest } from "next/server";

export const GOOGLE_OAUTH_STATE_COOKIE = "absp_google_oauth_state";
export const GOOGLE_OAUTH_RETURN_COOKIE = "absp_google_oauth_return";

export const googleOAuthCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 10 * 60,
};

export function getGoogleOAuthConfig(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const origin = configuredAppUrl || request.nextUrl.origin;

  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/api/auth/google/callback`,
  };
}
