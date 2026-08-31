import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { fail, handleApiError, success } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/session";
import { authorizeTeacherForStudentSubject } from "@/lib/auth/teacher-domain-policy";
import { connectDB } from "@/lib/db/connect";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { AssessmentAttempt } from "@/lib/db/models/AssessmentAttempt";
import { rebuildPracticeResult } from "@/lib/mcq/practice-result-projection";

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

    const attempt = await PracticeAttempt.findById(id);
    if (!attempt) return fail("Practice attempt not found.", 404);

    if (user.role === "teacher") {
      const decision = await authorizeTeacherForStudentSubject(
        user.id,
        attempt.student.toString(),
        attempt.subject,
      );
      if (!decision.ok) return fail(decision.message, decision.status);
    }

    if (attempt.voidedAt) {
      return success({ message: "Result is already voided.", attempt });
    }

    const before = { isCancelled: Boolean(attempt.isCancelled) };
    const voidedAt = new Date();
    const voidedBy = new Types.ObjectId(user.id);
    attempt.isCancelled = true;
    attempt.voidedAt = voidedAt;
    attempt.voidedBy = voidedBy;
    attempt.voidReason = reason;
    await attempt.save();

    await rebuildPracticeResult(attempt);
    if (attempt.assessmentAttemptId) await AssessmentAttempt.updateOne({ _id: attempt.assessmentAttemptId }, { $set: { status: "voided", voidedAt, voidedBy, voidReason: reason } });

    try {
      await writeAuditLog({
        request,
        actor: user,
        action: "practice-result.void",
        resourceType: "PracticeAttempt",
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
      await rebuildPracticeResult(attempt);
      if (attempt.assessmentAttemptId) await AssessmentAttempt.updateOne({ _id: attempt.assessmentAttemptId }, { $set: { status: "submitted" }, $unset: { voidedAt: 1, voidedBy: 1, voidReason: 1 } });
      throw error;
    }

    return success({ message: "Practice result voided successfully.", attempt });
  } catch (error) {
    return handleApiError(error);
  }
}
