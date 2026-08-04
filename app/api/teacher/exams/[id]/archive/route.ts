import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";

const archiveSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher"]);
    const { id } = await context.params;
    const { reason } = archiveSchema.parse(await request.json());

    const exam = await McqExam.findOne({ _id: id, teacher: user.id });
    if (!exam) return fail("Exam not found or you do not have permission to archive it.", 404);
    if (exam.isArchived) return success({ message: "Exam is already archived.", exam });

    const before = {
      isArchived: exam.isArchived,
      isPublished: exam.isPublished,
      resultsPublished: exam.resultsPublished,
    };
    const archivedAt = new Date();
    exam.isArchived = true;
    exam.archivedAt = archivedAt;
    exam.archivedBy = new Types.ObjectId(user.id);
    exam.archiveReason = reason;
    exam.isPublished = false;
    exam.resultsPublished = false;
    await exam.save();

    try {
      await writeAuditLog({
        request,
        actor: user,
        action: "mcq-exam.archive",
        resourceType: "McqExam",
        resourceId: exam._id,
        reason,
        before,
        after: { isArchived: true, archivedAt: archivedAt.toISOString() },
      });
    } catch (error) {
      exam.isArchived = before.isArchived;
      exam.isPublished = before.isPublished;
      exam.resultsPublished = before.resultsPublished;
      exam.archivedAt = undefined;
      exam.archivedBy = undefined;
      exam.archiveReason = undefined;
      await exam.save();
      throw error;
    }

    return success({ message: "Exam archived successfully.", exam });
  } catch (error) {
    return handleApiError(error);
  }
}
