import { NextRequest, NextResponse } from "next/server";

import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import {
  normalizeSessionVersion,
  sessionVersionFilter,
  sessionVersionMatches,
} from "@/lib/auth/session-version";
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
      const user = await User.findById(payload.userId).select("+refreshTokenHash");

      if (user?.refreshTokenHash) {
        const sessionVersion = normalizeSessionVersion(user.sessionVersion);
        const matchesSession = sessionVersionMatches(payload.sessionVersion, sessionVersion);
        const matchesStoredToken = matchesSession
          ? await verifyPassword(refreshToken, user.refreshTokenHash)
          : false;

        if (matchesStoredToken) {
          await User.updateOne(
            {
              _id: user._id,
              refreshTokenHash: user.refreshTokenHash,
              ...sessionVersionFilter(sessionVersion),
            },
            {
              $unset: { refreshTokenHash: "" },
              $inc: { sessionVersion: 1 },
            },
          );
        }
      }
    }
  } catch {
    // Logout should be idempotent even if the refresh token is already invalid.
  }

  clearAuthCookies(response);
  return response;
}
