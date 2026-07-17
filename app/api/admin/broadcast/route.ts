import { NextRequest } from "next/server";
import type { QueryFilter } from "mongoose";
import webpush from "web-push";

import { success, fail, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PushSubscription, type IPushSubscription } from "@/lib/db/models/PushSubscription";
import { User } from "@/lib/db/models/User";

// Set up VAPID details
webpush.setVapidDetails(
  "mailto:admin@albirunistudypoint.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, ["admin", "teacher"]);
    await connectDB();

    const body = await request.json();
    const { title, message, url, targetClass, targetAudience } = body;

    if (!message) {
      return fail("Message content is required", 400);
    }

    const query: QueryFilter<IPushSubscription> = {};

    // Filter by PWA-installed only
    if (targetAudience === "pwa-only") {
      query.isInstalledApp = true;
    }

    // Filter by student class
    if (targetClass) {
      const students = await User.find(
        { studentClass: targetClass, role: "student" },
        { _id: 1 }
      ).lean();
      const studentIds = students.map((s) => s._id);
      
      if (studentIds.length === 0) {
        return success({ message: "No students registered in this class.", count: 0 });
      }
      query.userId = { $in: studentIds };
    }

    const subscriptions = await PushSubscription.find(query).lean();

    if (subscriptions.length === 0) {
      return success({ message: "No active device subscriptions found matching criteria.", count: 0 });
    }

    const payload = JSON.stringify({
      title: title || "ABSP Announcement",
      body: message,
      url: url || "/",
    });

    const sendPromises = subscriptions.map((sub) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.subscription.endpoint,
            keys: {
              p256dh: sub.subscription.keys.p256dh,
              auth: sub.subscription.keys.auth,
            },
          },
          payload
        )
        .catch(async (err) => {
          // Clean up expired or invalid subscriptions
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
          console.error("Error sending push notification to endpoint:", sub.subscription.endpoint, err.message);
        })
    );

    await Promise.all(sendPromises);

    return success({
      message: `Broadcast sent successfully to ${subscriptions.length} devices.`,
      count: subscriptions.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
