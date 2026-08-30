import { NextRequest } from "next/server";

import { classFilterForStudent } from "@/lib/content/classes";
import { applyGuestClassFilter } from "@/lib/content/guest-scope.server";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Video } from "@/lib/db/models/Video";
import { VideoProgress } from "@/lib/db/models/VideoProgress";
import { createVideoSchema } from "@/lib/validations/video.schema";
import { authorizeTeacherContentScope } from "@/lib/auth/teacher-domain-policy";
import { redactGuestVideoUrl } from "@/lib/content/video-visibility";
import { resolveCanonicalContentScope } from "@/lib/canonical-content-scope";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const scope = searchParams.get("scope");
    const query: Record<string, unknown> = {};
    let studentId: string | null = null;

    if (scope === "guest") {
      const level = searchParams.get("level");
      const classParam = searchParams.get("class");
      if (level === "SSC" || level === "HSC") {
        const classes = level === "SSC" ? ["class-9", "class-10"] : ["class-11", "class-12"];
        query.targetClasses = { $in: classes };
        query.isPublished = true;
      } else if (classParam) {
        const guestError = applyGuestClassFilter(
          scope,
          classParam,
          query,
          "isPublished",
        );
        if (guestError) {
          return guestError;
        }
      } else {
        return fail("Class or level is required.", 400);
      }
    } else if (scope === "student") {
      const user = await requireAuth(request, ["student"]);
      const studentClass = requireStudentClass(user);
      studentId = user.id;

      query.isPublished = true;
      Object.assign(query, classFilterForStudent(studentClass));
    } else {
      const user = await requireAuth(request, ["admin", "teacher"]);

      if (user.role === "teacher") {
        query.teacher = user.id;
      }
    }

    const videoQuery = Video.find(query).sort({ createdAt: -1 }).limit(100);
    if (scope === "guest") videoQuery.select("-videoUrl");
    const videos = await videoQuery.lean();
    const progress = studentId
      ? await VideoProgress.find({
          student: studentId,
          video: { $in: videos.map((video) => video._id) },
        }).lean()
      : [];
    const progressMap = new Map(
      progress.map((item) => [String(item.video), item]),
    );

    return success({
      videos: videos.map((video) => {
        const mapped = redactGuestVideoUrl(scope, mapDocWithTargetClasses(video));
        const itemProgress = progressMap.get(String(video._id));
        return {
          ...mapped,
          progress: itemProgress
            ? {
                status: itemProgress.status,
                progressPercent: itemProgress.progressPercent,
                lastWatchedAt: itemProgress.lastWatchedAt,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher"]);
    const parsed = createVideoSchema.parse(await request.json());

    await connectDB();
    const canonicalScope = await resolveCanonicalContentScope(parsed.subjectId, parsed.subject);
    if (!canonicalScope.ok) return fail(canonicalScope.message, canonicalScope.status);

    if (user.role === "teacher") {
      if (!parsed.subject) return fail("Subject is required for teacher content.", 400);
      const decision = await authorizeTeacherContentScope(
        user.id,
        parsed.targetClasses,
        parsed.subject,
        canonicalScope.subjectId,
      );
      if (!decision.ok) return fail(decision.message, decision.status);
    }

    const video = await Video.create({
      organizationId: canonicalScope.organizationId,
      subjectId: canonicalScope.subjectId,
      title: parsed.title,
      description: parsed.description || undefined,
      subject: parsed.subject,
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
