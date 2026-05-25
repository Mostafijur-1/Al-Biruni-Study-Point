import { NextRequest, NextResponse } from "next/server";

import { fail, handleApiError } from "@/lib/api/response";
import {
  ACCESS_COOKIE,
  accessCookieOptions,
  clearAuthCookies,
  REFRESH_COOKIE,
  refreshCookieOptions,
  ROLE_COOKIE,
  roleCookieOptions,
} from "@/lib/auth/cookies";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { serializeUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

    if (!refreshToken) {
      return fail("Missing refresh token.", 401);
    }

    const payload = verifyRefreshToken(refreshToken);

    await connectDB();
    const user = await User.findById(payload.userId).select("+refreshTokenHash");

    if (!user?.refreshTokenHash || !user.isActive) {
      const response = NextResponse.json(
        { success: false, error: { message: "Invalid session." } },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    const matchesStoredToken = await verifyPassword(refreshToken, user.refreshTokenHash);

    if (!matchesStoredToken) {
      const response = NextResponse.json(
        { success: false, error: { message: "Invalid session." } },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

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

    const response = NextResponse.json({
      success: true,
      data: { user: serializeUser(user) },
    });

    response.cookies.set(ACCESS_COOKIE, nextAccessToken, accessCookieOptions);
    response.cookies.set(REFRESH_COOKIE, nextRefreshToken, refreshCookieOptions);
    response.cookies.set(ROLE_COOKIE, user.role, roleCookieOptions);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
