import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, success } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { CoachingBatchSubject } from "@/lib/db/models/CoachingBatchSubject";

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(12) });

export async function GET(request: NextRequest) {
  try {
    const { limit } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    await connectDB();
    const batches = await Batch.find({ status: "active" })
      .select("name code mode defaultFeeTk capacity activeEnrollmentCount startsAt endsAt status")
      .sort({ startsAt: 1, createdAt: -1 })
      .limit(limit)
      .lean();
    const subjectRows = await CoachingBatchSubject.find({
      batchId: { $in: batches.map((batch) => batch._id) }, status: "active",
    }).sort({ sortOrder: 1 }).lean();
    const subjects = await AcademicSubject.find({ _id: { $in: subjectRows.map((row) => row.subjectId) } })
      .select("name nameBn code").lean();
    const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));

    return success({
      batches: batches.map((batch) => ({
        id: String(batch._id), name: batch.name, code: batch.code,
        mode: batch.mode ?? "offline", defaultFeeTk: batch.defaultFeeTk ?? 0,
        capacity: batch.capacity, activeEnrollmentCount: batch.activeEnrollmentCount ?? 0,
        startsAt: batch.startsAt?.toISOString(), endsAt: batch.endsAt?.toISOString(),
        subjects: subjectRows
          .filter((row) => String(row.batchId) === String(batch._id))
          .map((row) => {
            const subject = subjectById.get(String(row.subjectId));
            return subject ? { id: String(subject._id), name: subject.name, nameBn: subject.nameBn, code: subject.code } : null;
          })
          .filter(Boolean),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
