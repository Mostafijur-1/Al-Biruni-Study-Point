import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PushSubscription } from "@/lib/db/models/PushSubscription";
import { success, fail, handleApiError } from "@/lib/api/response";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { consumeRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";
import { pwaSubscriptionSchema } from "@/lib/pwa-contracts";
import { User } from "@/lib/db/models/User";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const rateLimit = await consumeRateLimit(
      "public:pwa-subscribe",
      getClientIdentifier(request),
      { limit: 20, windowMs: 10 * 60 * 1000 },
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16 * 1024) return fail("Request body is too large.", 413);

    const { deviceId, subscription, isInstalledApp } = pwaSubscriptionSchema.parse(
      await request.json(),
    );

    // Try to extract userId from session if authenticated
    let userId: string | undefined;
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const activeUser = await User.exists({ _id: payload.userId, isActive: true });
        if (activeUser) userId = payload.userId;
      } catch {
        // Session invalid/expired, register anonymously
      }
    }

    const update: Record<string, unknown> = {
      $set: { deviceId, subscription, isInstalledApp },
    };
    if (userId) {
      (update.$set as Record<string, unknown>).userId = userId;
    } else {
      update.$unset = { userId: 1 };
    }

    // The browser-issued endpoint identifies the subscription. The client
    // device ID is metadata, not an authorization credential.
    await PushSubscription.findOneAndUpdate(
      { "subscription.endpoint": subscription.endpoint },
      update,
      { upsert: true, new: true }
    );

    return success({ message: "Push subscription registered successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
