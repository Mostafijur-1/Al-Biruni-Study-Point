import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { AppInstall } from "@/lib/db/models/AppInstall";
import { success, fail, handleApiError } from "@/lib/api/response";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { consumeRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";
import {
  getPwaEventKey,
  getTelemetryExpiry,
  hashNetworkIdentifier,
  pwaTrackSchema,
  truncateUserAgent,
} from "@/lib/pwa-contracts";
import { getRequiredEnv } from "@/lib/env";
import { User } from "@/lib/db/models/User";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const clientIdentifier = getClientIdentifier(request);
    const rateLimit = await consumeRateLimit(
      "public:pwa-track",
      clientIdentifier,
      { limit: 30, windowMs: 10 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 4 * 1024) return fail("Request body is too large.", 413);

    const { deviceId, type } = pwaTrackSchema.parse(await request.json());

    // Attempt to extract userId from auth session cookies if present
    let userId: string | undefined;
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const activeUser = await User.exists({ _id: payload.userId, isActive: true });
        if (activeUser) userId = payload.userId;
      } catch {
        // Session token might be expired or invalid; proceed as anonymous tracking
      }
    }

    const userAgent = truncateUserAgent(request.headers.get("user-agent"));
    const ipHash = hashNetworkIdentifier(clientIdentifier, getRequiredEnv("JWT_ACCESS_SECRET"));
    const eventKey = getPwaEventKey(type);

    await AppInstall.findOneAndUpdate(
      { deviceId, eventKey },
      {
        $setOnInsert: {
          deviceId,
          userId,
          type,
          eventKey,
          userAgent,
          ipHash,
          expiresAt: getTelemetryExpiry(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return success({ message: "Analytics logged successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
