import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PushSubscription } from "@/lib/db/models/PushSubscription";
import { success, fail, handleApiError } from "@/lib/api/response";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { deviceId, subscription, isInstalledApp } = body;

    if (!deviceId || !subscription || !subscription.endpoint || !subscription.keys) {
      return fail("Invalid subscription parameters", 400);
    }

    // Try to extract userId from session if authenticated
    let userId: string | undefined;
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        userId = payload.userId;
      } catch (err) {
        // Session invalid/expired, register anonymously
      }
    }

    // Upsert the subscription by deviceId
    await PushSubscription.findOneAndUpdate(
      { deviceId },
      {
        userId,
        subscription,
        isInstalledApp: !!isInstalledApp,
      },
      { upsert: true, new: true }
    );

    return success({ message: "Push subscription registered successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
