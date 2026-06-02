import { NextRequest } from "next/server";

import { classFilterForStudent } from "@/lib/content/classes";
import { applyGuestClassFilter } from "@/lib/content/guest-scope.server";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Video } from "@/lib/db/models/Video";
import { createVideoSchema } from "@/lib/validations/video.schema";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const scope = searchParams.get("scope");
    const query: Record<string, unknown> = {};

    const guestError = applyGuestClassFilter(
      scope,
      searchParams.get("class"),
      query,
      "isPublished",
    );

    if (guestError) {
      return guestError;
    }

    if (scope === "student") {
      const user = await requireAuth(request, ["student"]);
      const studentClass = requireStudentClass(user);

      query.isPublished = true;
      Object.assign(query, classFilterForStudent(studentClass));
    } else if (scope !== "guest") {
      const user = await requireAuth(request, ["admin", "teacher"]);

      if (user.role === "teacher") {
        query.teacher = user.id;
      }
    }

    const videos = await Video.find(query).sort({ createdAt: -1 }).limit(100).lean();

    return success({ videos: videos.map(mapDocWithTargetClasses) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher"]);
    const parsed = createVideoSchema.parse(await request.json());

    await connectDB();

    const video = await Video.create({
      title: parsed.title,
      description: parsed.description || undefined,
      videoUrl: parsed.videoUrl,
      targetClasses: parsed.targetClasses,
      teacher: user.id,
      isPublished: parsed.isPublished,
    });

    await Video.updateOne({ _id: video._id }, { $set: { targetClasses: parsed.targetClasses } });

    const saved = await Video.findById(video._id).lean();

    return success(
      { video: saved ? mapDocWithTargetClasses(saved) : mapDocWithTargetClasses(video.toObject()) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
