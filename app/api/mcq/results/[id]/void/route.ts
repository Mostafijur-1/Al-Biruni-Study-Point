import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { canManageTeacherOwnedResource } from "@/lib/auth/resource-policy";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { connectDB } from "@/lib/db/connect";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import type { IMcqExam } from "@/lib/db/models/McqExam";
import "@/lib/db/models/McqExam";

const voidSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher", "admin"]);
    const { id } = await context.params;
    const { reason } = voidSchema.parse(await request.json());

    const attempt = await McqExamAttempt.findById(id).populate("exam");
    if (!attempt) return fail("Attempt not found.", 404);

    const exam = attempt.exam as unknown as IMcqExam;
    if (!canManageTeacherOwnedResource(user, exam.teacher)) {
      return fail("Attempt not found or you do not have permission to void it.", 404);
    }

    if (attempt.voidedAt) {
      return success({ message: "Result is already voided.", attempt });
    }

    const before = {
      isCancelled: Boolean(attempt.isCancelled),
      voidedAt: null,
    };
    const voidedAt = new Date();
    attempt.isCancelled = true;
    attempt.voidedAt = voidedAt;
    attempt.voidedBy = new Types.ObjectId(user.id);
    attempt.voidReason = reason;
    await attempt.save();

    try {
      await writeAuditLog({
        request,
        actor: user,
        action: "mcq-result.void",
        resourceType: "McqExamAttempt",
        resourceId: attempt._id,
        reason,
        before,
        after: { isCancelled: true, voidedAt: voidedAt.toISOString() },
      });
    } catch (error) {
      attempt.isCancelled = before.isCancelled;
      attempt.voidedAt = undefined;
      attempt.voidedBy = undefined;
      attempt.voidReason = undefined;
      await attempt.save();
      throw error;
    }

    return success({ message: "Result voided successfully.", attempt });
  } catch (error) {
    return handleApiError(error);
  }
}
