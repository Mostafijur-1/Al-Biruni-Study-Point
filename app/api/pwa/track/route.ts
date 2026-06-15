import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { AppInstall } from "@/lib/db/models/AppInstall";
import { success, fail, handleApiError } from "@/lib/api/response";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { deviceId, type } = body;

    if (!deviceId || !type || !["install", "launch"].includes(type)) {
      return fail("Invalid tracking parameters", 400);
    }

    // Attempt to extract userId from auth session cookies if present
    let userId: string | undefined;
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        userId = payload.userId;
      } catch (err) {
        // Session token might be expired or invalid; proceed as anonymous tracking
      }
    }

    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || undefined;

    // Create the record
    await AppInstall.create({
      deviceId,
      userId,
      type,
      userAgent,
      ipAddress,
    });

    return success({ message: "Analytics logged successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
