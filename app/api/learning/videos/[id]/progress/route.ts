import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { classFilterForStudent } from "@/lib/content/classes";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { Video } from "@/lib/db/models/Video";
import { VideoProgress } from "@/lib/db/models/VideoProgress";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { StudentClass } from "@/types";

type Context = { params: Promise<{ id: string }> };

const progressSchema = z.object({
  status: z.enum(["started", "completed"]).default("started"),
  watchedSeconds: z.number().min(0).max(86_400).optional(),
  durationSeconds: z.number().min(0).max(86_400).optional(),
});

async function getAccessibleVideo(studentClass: StudentClass, videoId: string) {
  return Video.findOne({
    _id: videoId,
    isPublished: true,
    ...classFilterForStudent(studentClass),
  }).lean();
}

export async function GET(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const { id } = await context.params;
    const video = await getAccessibleVideo(studentClass, id);
    if (!video) return fail("ভিডিওটি পাওয়া যায়নি।", 404);

    const progress = await VideoProgress.findOne({
      student: user.id,
      video: video._id,
    }).lean();

    return success({
      video: {
        id: String(video._id),
        title: video.title,
        description: video.description,
        videoUrl: video.videoUrl,
      },
      progress: progress
        ? {
            status: progress.status,
            watchedSeconds: progress.watchedSeconds,
            durationSeconds: progress.durationSeconds,
            progressPercent: progress.progressPercent,
            lastWatchedAt: progress.lastWatchedAt,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);
    const rateLimit = await consumeRateLimit("student:video-progress", user.id, {
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const { id } = await context.params;
    const [video, parsed] = await Promise.all([
      getAccessibleVideo(studentClass, id),
      progressSchema.parseAsync(await request.json()),
    ]);
    if (!video) return fail("ভিডিওটি পাওয়া যায়নি।", 404);

    const watchedSeconds = parsed.watchedSeconds ?? 0;
    const durationSeconds = parsed.durationSeconds ?? 0;
    const calculatedPercent =
      durationSeconds > 0
        ? Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100))
        : 0;
    const existingProgress = await VideoProgress.findOne({
      student: user.id,
      video: video._id,
    })
      .select("status")
      .lean();
    const completed =
      existingProgress?.status === "completed" ||
      parsed.status === "completed" ||
      calculatedPercent >= 95;
    const now = new Date();

    const progress = await VideoProgress.findOneAndUpdate(
      { student: user.id, video: video._id },
      {
        $set: {
          status: completed ? "completed" : "started",
          lastWatchedAt: now,
          ...(completed ? { completedAt: now } : {}),
        },
        $setOnInsert: { startedAt: now },
        $max: {
          watchedSeconds,
          durationSeconds,
          progressPercent: completed ? 100 : calculatedPercent,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return success({
      status: progress.status,
      watchedSeconds: progress.watchedSeconds,
      durationSeconds: progress.durationSeconds,
      progressPercent: progress.progressPercent,
      completedAt: progress.completedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
