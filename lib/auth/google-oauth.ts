import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const GOOGLE_OAUTH_STATE_COOKIE = "absp_google_oauth_state";
export const GOOGLE_OAUTH_RETURN_COOKIE = "absp_google_oauth_return";
export const GOOGLE_OAUTH_FLOW_COOKIE = "absp_google_oauth_flow";

export const googleOAuthCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 10 * 60,
};

export function createGoogleOAuthState(
  flow: string,
  returnUrl?: string | null,
): string {
  const secret =
    process.env.JWT_ACCESS_SECRET ||
    "absp_default_jwt_state_secret_minimum_32_characters";
  const timestamp = Date.now().toString(36);
  const nonce = randomBytes(16).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      flow,
      returnUrl: returnUrl || null,
      nonce,
      ts: timestamp,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyGoogleOAuthState(state: string): {
  valid: boolean;
  flow: string;
  returnUrl: string | null;
} {
  try {
    const secret =
      process.env.JWT_ACCESS_SECRET ||
      "absp_default_jwt_state_secret_minimum_32_characters";
    const [payload, signature] = state.split(".");
    if (!payload || !signature) {
      return { valid: false, flow: "login", returnUrl: null };
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");
    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSignature);
    if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
      return { valid: false, flow: "login", returnUrl: null };
    }

    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { flow?: string; returnUrl?: string; ts?: string };
    const createdTime = parseInt(data.ts || "0", 36);
    if (Date.now() - createdTime > 15 * 60 * 1000) {
      return { valid: false, flow: data.flow || "login", returnUrl: null };
    }

    return {
      valid: true,
      flow: data.flow === "register" ? "register" : "login",
      returnUrl: data.returnUrl || null,
    };
  } catch {
    return { valid: false, flow: "login", returnUrl: null };
  }
}

export function getCanonicalSiteOrigin(request: NextRequest): string {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") || "https";

  let origin = configuredAppUrl;
  if (
    !origin &&
    forwardedHost &&
    !forwardedHost.includes("localhost") &&
    !forwardedHost.includes("127.0.0.1")
  ) {
    origin = `${forwardedProto}://${forwardedHost}`;
  }
  if (!origin) {
    origin = request.nextUrl.origin;
  }

  if (
    !origin.startsWith("http://localhost") &&
    !origin.startsWith("http://127.0.0.1")
  ) {
    origin = origin.replace(/^http:\/\//, "https://");
  }

  return origin;
}

export function getGoogleOAuthConfig(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = getCanonicalSiteOrigin(request);

  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/api/auth/google/callback`,
  };
}



