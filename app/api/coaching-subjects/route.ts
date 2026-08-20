import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";

import { areAcademicWritesEnabled } from "@/lib/academic-rules";
import { ApiRouteError } from "@/lib/api-error";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { Batch } from "@/lib/db/models/Batch";
import { BatchEnrollment } from "@/lib/db/models/BatchEnrollment";
import { CoachingBatchSubject } from "@/lib/db/models/CoachingBatchSubject";
import { TeacherAssignment } from "@/lib/db/models/TeacherAssignment";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const configureSchema = z.object({
  batchId: objectId,
  subjectIds: z.array(objectId).min(1).max(30),
});

async function assertBatchReadScope(role: string, actorId: string, batchId: string) {
  if (role === "admin") return;
  const allowed = role === "teacher"
    ? await TeacherAssignment.exists({ batchId, teacherId: actorId, status: "active" })
    : await BatchEnrollment.exists({ batchId, studentId: actorId, status: "active" });
  if (!allowed) throw new ApiRouteError("Batch not found.", 404);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin", "teacher", "student"]);
    const batchId = objectId.parse(request.nextUrl.searchParams.get("batchId"));
    await assertBatchReadScope(actor.role, actor.id, batchId);
    const batch = await Batch.findById(batchId).select("organizationId studentClass").lean();
    if (!batch) throw new ApiRouteError("Batch not found.", 404);
    const rows = await CoachingBatchSubject.find({ batchId, status: "active" }).sort({ sortOrder: 1 }).lean();
    const subjects = await AcademicSubject.find({ _id: { $in: rows.map((row) => row.subjectId) } }).select("code name nameBn").lean();
    const byId = new Map(subjects.map((subject) => [String(subject._id), subject]));
    const availableSubjects = actor.role === "admin"
      ? await AcademicSubject.find({
          status: "active",
          ...(batch.organizationId ? { organizationId: batch.organizationId } : {}),
          ...(batch.studentClass ? { classLevels: batch.studentClass } : {}),
        }).select("code name nameBn").sort({ code: 1 }).lean()
      : [];
    return success({
      batchId,
      subjects: rows.map((row) => ({ id: String(row.subjectId), ...(byId.get(String(row.subjectId)) ?? {}) })),
      availableSubjects: availableSubjects.map((subject) => ({ id: String(subject._id), code: subject.code, name: subject.name, nameBn: subject.nameBn })),
    });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, ["admin"]);
    if (!areAcademicWritesEnabled(process.env.ACADEMIC_WRITES_ENABLED)) throw new ApiRouteError("Academic write workflows are not enabled.", 503);
    const input = configureSchema.parse(await request.json());
    const ids = [...new Set(input.subjectIds)];
    if (ids.length !== input.subjectIds.length) throw new ApiRouteError("Duplicate subject configuration.", 400);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const batch = await Batch.findOne({ _id: input.batchId, status: { $in: ["planned", "active"] } }).session(session);
        if (!batch) throw new ApiRouteError("Batch not found or inactive.", 404);
        const validSubjects = await AcademicSubject.find({
          _id: { $in: ids },
          status: "active",
          ...(batch.organizationId ? { organizationId: batch.organizationId } : {}),
          ...(batch.studentClass ? { classLevels: batch.studentClass } : {}),
        }).select("_id organizationId").session(session).lean();
        if (validSubjects.length !== ids.length) throw new ApiRouteError("One or more subjects are unavailable for this batch.", 409);
        const subjectOrganizations = new Map(validSubjects.map((subject) => [String(subject._id), subject.organizationId]));
        await Promise.all(ids.map((subjectId, index) => CoachingBatchSubject.findOneAndUpdate(
          { batchId: batch._id, subjectId },
          { $set: { organizationId: batch.organizationId ?? subjectOrganizations.get(subjectId), branchId: batch.branchId, status: "active", sortOrder: index, createdBy: actor.id } },
          { upsert: true, runValidators: true, session },
        )));
        await CoachingBatchSubject.updateMany({ batchId: batch._id, subjectId: { $nin: ids }, status: "active" }, { $set: { status: "archived" } }, { session });
      });
    } finally { await session.endSession(); }
    return success({ batchId: input.batchId, configuredSubjectCount: ids.length });
  } catch (error) { return handleApiError(error); }
}
