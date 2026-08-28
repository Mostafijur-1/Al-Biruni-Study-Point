import { NextRequest } from "next/server";
import webpush from "web-push";

import { fail, success, handleApiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PushSubscription } from "@/lib/db/models/PushSubscription";
import { User } from "@/lib/db/models/User";

export async function POST(request: NextRequest) {
  return handleCronTrigger(request);
}

// Vercel Cron invokes configured routes with GET requests.
export async function GET(request: NextRequest) {
  return handleCronTrigger(request);
}

async function handleCronTrigger(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) return fail("Cron trigger is not configured.", 503);
    if (authHeader !== `Bearer ${cronSecret}`) return fail("Unauthorized", 401);
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    if (!vapidPublicKey || !vapidPrivateKey) {
      return fail("Push notification delivery is not configured.", 503);
    }
    webpush.setVapidDetails(
      "mailto:admin@albirunistudypoint.com",
      vapidPublicKey,
      vapidPrivateKey,
    );

    console.info("Daily exam reminder started");
    await connectDB();

    const now = new Date();
    // Bangladesh Standard Time is UTC+6
    const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const startOfTodayBD = new Date(Date.UTC(
      bdNow.getUTCFullYear(),
      bdNow.getUTCMonth(),
      bdNow.getUTCDate(),
      0, 0, 0, 0
    ));
    const startOfTodayUTC = new Date(startOfTodayBD.getTime() - 6 * 60 * 60 * 1000);

    // 1. Find all student user IDs who have taken a test today
    const activeStudentIds = await PracticeAttempt.distinct("student", {
      createdAt: { $gte: startOfTodayUTC },
      isCancelled: { $ne: true },
      voidedAt: { $exists: false },
    });

    // 2. Exclude teachers/admins so they don't get student test reminders
    const excludedUsers = await User.find({ role: { $ne: "student" } }, { _id: 1 }).lean();
    const excludedUserIds = excludedUsers.map((u) => u._id);

    const excludeIds = [...activeStudentIds, ...excludedUserIds];

    // 3. Find target subscriptions
    const subscriptions = await PushSubscription.find({
      $or: [
        { userId: { $nin: excludeIds } }, // student users who haven't taken test
        { userId: { $exists: false } },   // anonymous installs
        { userId: null },
      ],
    }).lean();

    if (subscriptions.length === 0) {
      return success({ message: "No target device subscriptions found for daily reminder.", count: 0 });
    }

    const payload = JSON.stringify({
      title: "সময়মতো পরীক্ষা দাও! 📝",
      body: "তুমি আজকের MCQ প্র্যাকটিস পরীক্ষাটি এখনো দাওনি। এখনই অ্যাপে ঢুকে পরীক্ষা সম্পন্ন করো!",
      url: "/student/practice",
      tag: `daily-exam-${startOfTodayBD.toISOString().slice(0, 10)}`,
    });

    const deliveryResults = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.subscription.endpoint,
              keys: {
                p256dh: sub.subscription.keys.p256dh,
                auth: sub.subscription.keys.auth,
              },
            },
            payload,
          );
          return true;
        } catch (error) {
          const statusCode =
            typeof error === "object" && error !== null && "statusCode" in error
              ? Number(error.statusCode)
              : undefined;
          if (statusCode === 410 || statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
          console.error("Daily exam reminder delivery failed", {
            subscriptionId: String(sub._id),
            statusCode,
            message: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      }),
    );

    const delivered = deliveryResults.filter(Boolean).length;
    const failed = deliveryResults.length - delivered;
    console.info("Daily exam reminder completed", {
      subscriptions: subscriptions.length,
      delivered,
      failed,
    });

    if (delivered === 0) {
      return fail("Daily reminder delivery failed for every target device.", 502, {
        subscriptions: subscriptions.length,
        delivered,
        failed,
      });
    }

    return success({
      message: `Daily reminder delivered to ${delivered} devices.`,
      count: delivered,
      failed,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
