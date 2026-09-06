import { createHash } from "node:crypto";
import { type Db, type ObjectId } from "mongodb";

export const SINGLE_ORGANIZATION_VIDEO_ID = "20260906_single_organization_numpy_video_v1";

function ref(id: unknown) {
  return createHash("sha256").update(`video:${String(id)}`).digest("hex").slice(0, 16);
}

export async function inspectSingleOrganizationVideoBackfill(db: Db) {
  const [organizations, subjects, videos] = await Promise.all([
    db.collection("organizations")
      .find({ status: "active" }, { projection: { _id: 1 } })
      .limit(2)
      .toArray(),
    db.collection("academicsubjects")
      .find({ code: "ICT", status: "active" }, { projection: { _id: 1, organizationId: 1 } })
      .limit(2)
      .toArray(),
    db.collection("videos")
      .find(
        {
          title: /^\s*numpy\s*$/i,
          $or: [{ organizationId: null }, { subjectId: null }],
        },
        { projection: { _id: 1, organizationId: 1, subjectId: 1 } },
      )
      .limit(2)
      .toArray(),
  ]);

  if (organizations.length !== 1) {
    throw new Error("Video backfill requires exactly one active organization.");
  }
  const organizationId = organizations[0]._id as ObjectId;
  const organizationSubjects = subjects.filter(
    (subject) => String(subject.organizationId) === String(organizationId),
  );
  if (organizationSubjects.length !== 1) {
    throw new Error("Video backfill requires exactly one active ICT subject in the organization.");
  }
  if (videos.length > 1) {
    throw new Error("Video backfill found more than one eligible Numpy video.");
  }

  const subjectId = organizationSubjects[0]._id as ObjectId;
  const video = videos[0];
  const exceptions: Array<{ ref: string; reason: string }> = [];
  if (video?.organizationId && String(video.organizationId) !== String(organizationId)) {
    exceptions.push({ ref: ref(video._id), reason: "organization_scope_conflict" });
  }
  if (video?.subjectId && String(video.subjectId) !== String(subjectId)) {
    exceptions.push({ ref: ref(video._id), reason: "subject_scope_conflict" });
  }

  return {
    organizationId,
    subjectId,
    videoId: video?._id as ObjectId | undefined,
    report: {
      eligibleVideos: videos.length,
      plannedUpdates: video && exceptions.length === 0 ? 1 : 0,
      exceptionCount: exceptions.length,
      exceptions,
    },
  };
}

export async function applySingleOrganizationVideoBackfill(db: Db) {
  const inspected = await inspectSingleOrganizationVideoBackfill(db);
  if (inspected.report.exceptionCount) {
    throw new Error("Video backfill has unresolved exceptions.");
  }
  if (!inspected.videoId) return { ...inspected.report, modifiedCount: 0 };

  const result = await db.collection("videos").updateOne(
    {
      _id: inspected.videoId,
      title: /^\s*numpy\s*$/i,
      $or: [{ organizationId: null }, { subjectId: null }],
    },
    {
      $set: {
        organizationId: inspected.organizationId,
        subjectId: inspected.subjectId,
        subject: "ICT",
        updatedAt: new Date(),
      },
    },
  );
  return { ...inspected.report, modifiedCount: result.modifiedCount };
}
