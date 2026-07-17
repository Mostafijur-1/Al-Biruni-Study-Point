import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

import { success, handleApiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PushSubscription } from "@/lib/db/models/PushSubscription";
import { User } from "@/lib/db/models/User";

// Set up VAPID details conditionally (prevents errors during Next.js build phase if keys are missing)
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@albirunistudypoint.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Support both GET and POST to make cron triggering flexible (e.g., via simple webhook or GET cron request)
export async function GET(request: NextRequest) {
  return handleCronTrigger(request);
}

export async function POST(request: NextRequest) {
  return handleCronTrigger(request);
}

async function handleCronTrigger(request: NextRequest) {
  try {
    // Optional CRON secret validation if configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

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
      title: "সময়মত পরীক্ষা দিন! 📝",
      body: "আজকের MCQ প্র্যাকটিস পরীক্ষাটি এখনও দেওয়া হয়নি। এখনই অ্যাপে প্রবেশ করে পরীক্ষা সম্পন্ন করুন!",
      url: "/student/practice",
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
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
          console.error("Cron notification error for endpoint:", sub.subscription.endpoint, err.message);
        })
    );

    await Promise.all(sendPromises);

    return success({
      message: `Daily reminder notifications dispatched to ${subscriptions.length} devices.`,
      count: subscriptions.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
