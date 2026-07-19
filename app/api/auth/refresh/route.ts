import { NextRequest, NextResponse } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { setAuthCookies } from "@/lib/auth/set-auth-cookies";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { sanitizeLocalReturnUrl } from "@/lib/auth/safe-return-url";
import { serializeUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

function invalidSessionResponse() {
  const response = fail("Invalid session.", 401);
  clearAuthCookies(response);
  return response;
}

async function rotateSession(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) return null;

  try {
    const payload = verifyRefreshToken(refreshToken);
    await connectDB();
    const user = await User.findById(payload.userId).select("+refreshTokenHash");

    if (!user?.refreshTokenHash || !user.isActive) return null;

    const matchesStoredToken = await verifyPassword(refreshToken, user.refreshTokenHash);
    if (!matchesStoredToken) return null;

    const nextPayload = {
      userId: String(user._id),
      role: user.role,
      phone: user.phone,
      email: user.email,
    };
    const nextAccessToken = generateAccessToken(nextPayload);
    const nextRefreshToken = generateRefreshToken(nextPayload);

    user.refreshTokenHash = await hashPassword(nextRefreshToken);
    await user.save();

    return { user, accessToken: nextAccessToken, refreshToken: nextRefreshToken };
  } catch (error) {
    if (
      error instanceof Error &&
      ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)
    ) {
      return null;
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await rotateSession(request);
    if (!session) return invalidSessionResponse();

    const response = success({ user: serializeUser(session.user) });

    setAuthCookies(
      response,
      { accessToken: session.accessToken, refreshToken: session.refreshToken },
      session.user.role,
    );

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  const returnPath = sanitizeLocalReturnUrl(request.nextUrl.searchParams.get("next"));

  try {
    const session = await rotateSession(request);

    if (!session) {
      const loginUrl = new URL("/login", request.url);
      if (returnPath) loginUrl.searchParams.set("next", returnPath);
      loginUrl.searchParams.set("reason", "access");
      const response = NextResponse.redirect(loginUrl);
      clearAuthCookies(response);
      return response;
    }

    const destination = returnPath || `/${session.user.role}`;
    const response = NextResponse.redirect(new URL(destination, request.url));
    setAuthCookies(
      response,
      { accessToken: session.accessToken, refreshToken: session.refreshToken },
      session.user.role,
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
