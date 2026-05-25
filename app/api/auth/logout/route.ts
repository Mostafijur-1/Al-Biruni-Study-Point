import { NextRequest, NextResponse } from "next/server";

import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    data: { message: "Logged out successfully." },
  });

  try {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      await connectDB();
      await User.findByIdAndUpdate(payload.userId, { $unset: { refreshTokenHash: "" } });
    }
  } catch {
    // Logout should be idempotent even if the refresh token is already invalid.
  }

  clearAuthCookies(response);
  return response;
}
