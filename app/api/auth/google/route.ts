import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  getGoogleOAuthConfig,
  GOOGLE_OAUTH_FLOW_COOKIE,
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleOAuthCookieOptions,
} from "@/lib/auth/google-oauth";
import { getSafeReturnUrl } from "@/lib/auth/return-url";

export async function GET(request: NextRequest) {
  const flow = request.nextUrl.searchParams.get("flow") === "login" ? "login" : "register";
  const config = getGoogleOAuthConfig(request);
  if (!config) {
    const url = new URL(flow === "login" ? "/login" : "/register", request.url);
    url.searchParams.set("googleError", "Google sign-in is not configured yet.");
    const returnUrl = getSafeReturnUrl(request.nextUrl.searchParams.get("next"));
    if (returnUrl) url.searchParams.set("next", returnUrl);
    return NextResponse.redirect(url);
  }

  const state = randomBytes(32).toString("base64url");
  const returnUrl = getSafeReturnUrl(request.nextUrl.searchParams.get("next"));
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, googleOAuthCookieOptions);
  response.cookies.set(GOOGLE_OAUTH_FLOW_COOKIE, flow, googleOAuthCookieOptions);
  if (returnUrl) {
    response.cookies.set(GOOGLE_OAUTH_RETURN_COOKIE, returnUrl, googleOAuthCookieOptions);
  } else {
    response.cookies.delete(GOOGLE_OAUTH_RETURN_COOKIE);
  }
  return response;
}
