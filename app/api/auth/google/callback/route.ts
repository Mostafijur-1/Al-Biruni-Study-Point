import { NextRequest, NextResponse } from "next/server";

import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import {
  getGoogleOAuthConfig,
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "@/lib/auth/google-oauth";
import { hashPassword } from "@/lib/auth/password";
import { resolvePostAuthRedirect } from "@/lib/auth/return-url";
import { setAuthCookies } from "@/lib/auth/set-auth-cookies";
import {
  nextSessionVersion,
  normalizeSessionVersion,
  sessionVersionFilter,
} from "@/lib/auth/session-version";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

type GoogleTokenResponse = { access_token?: string };
type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function registrationError(request: NextRequest, message: string) {
  const url = new URL("/register", request.url);
  url.searchParams.set("googleError", message);
  const response = NextResponse.redirect(url);
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_RETURN_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig(request);
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const code = request.nextUrl.searchParams.get("code");

  if (!config) return registrationError(request, "Google registration is not configured yet.");
  if (!state || !expectedState || state !== expectedState || !code) {
    return registrationError(request, "Google registration could not be verified. Please try again.");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed.");
    const token = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!token.access_token) throw new Error("Google did not return an access token.");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error("Google profile request failed.");
    const profile = (await profileResponse.json()) as GoogleUserInfo;
    if (!profile.sub || !profile.email || !profile.email_verified) {
      return registrationError(request, "A verified Google email address is required.");
    }

    await connectDB();
    const email = profile.email.toLowerCase();
    let user = await User.findOne({ googleId: profile.sub }).select("+googleId");
    if (!user) user = await User.findOne({ email }).select("+googleId");

    const isNewUser = !user;
    const wasGoogleAccount = Boolean(user?.googleId);
    if (user && user.role !== "student") {
      return registrationError(request, "This Google email belongs to a non-student account.");
    }

    if (!user) {
      user = await User.create({
        name: profile.name?.trim() || email.split("@")[0],
        email,
        googleId: profile.sub,
        avatar: profile.picture,
        role: "student",
        approvalStatus: "approved",
      });
    } else {
      user.googleId = profile.sub;
      if (profile.picture) user.avatar = profile.picture;
      if (!wasGoogleAccount && user.phone && user.studentClass) user.onboardingCompletedAt = new Date();
      await user.save();
    }

    if (!user.isActive) return registrationError(request, "This account is inactive.");

    const currentSessionVersion = normalizeSessionVersion(user.sessionVersion);
    const sessionVersion = nextSessionVersion(currentSessionVersion);
    const onboardingComplete = Boolean(
      user.onboardingCompletedAt || (!isNewUser && !wasGoogleAccount && user.phone && user.studentClass),
    );
    const tokenPayload = {
      userId: String(user._id),
      role: user.role,
      sessionVersion,
      email: user.email,
      phone: user.phone,
      onboardingComplete,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const refreshTokenHash = await hashPassword(refreshToken);
    const sessionUser = await User.findOneAndUpdate(
      { _id: user._id, ...sessionVersionFilter(currentSessionVersion) },
      { $set: { refreshTokenHash, sessionVersion } },
      { new: true },
    );
    if (!sessionUser) return registrationError(request, "Please try signing in with Google again.");

    const savedReturnUrl = request.cookies.get(GOOGLE_OAUTH_RETURN_COOKIE)?.value;
    const destination = onboardingComplete
      ? resolvePostAuthRedirect("student", savedReturnUrl)
      : `/register/complete${savedReturnUrl ? `?next=${encodeURIComponent(savedReturnUrl)}` : ""}`;
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    response.cookies.delete(GOOGLE_OAUTH_RETURN_COOKIE);
    setAuthCookies(response, { accessToken, refreshToken }, "student");
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return registrationError(request, "Google registration failed. Please try again.");
  }
}
