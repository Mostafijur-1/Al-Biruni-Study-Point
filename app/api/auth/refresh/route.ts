import { NextRequest } from "next/server";

import { fail, handleApiError, success } from "@/lib/api/response";
import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { setAuthCookies } from "@/lib/auth/set-auth-cookies";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { serializeUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

function invalidSessionResponse() {
  const response = fail("Invalid session.", 401);
  clearAuthCookies(response);
  return response;
}

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
      return invalidSessionResponse();
    }

    const matchesStoredToken = await verifyPassword(refreshToken, user.refreshTokenHash);

    if (!matchesStoredToken) {
      return invalidSessionResponse();
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

    const response = success({ user: serializeUser(user) });

    setAuthCookies(response, { accessToken: nextAccessToken, refreshToken: nextRefreshToken }, user.role);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
