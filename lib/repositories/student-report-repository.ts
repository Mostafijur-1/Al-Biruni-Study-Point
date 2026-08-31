import type { RequestContext } from "@/lib/application/request-context";
import { canonicalScopeFilter } from "@/lib/application/scope-policy";
import { Batch } from "@/lib/db/models/Batch";
import { StudentReportComment } from "@/lib/db/models/StudentReportComment";
import type { Types } from "mongoose";

export function findReportBatch(context: RequestContext, batchId: string) {
  return Batch.findOne({ ...canonicalScopeFilter(context.scope), _id: batchId }).select("organizationId branchId academicSessionId").lean();
}

export function createReportComment(context: RequestContext, input: {
  organizationId?: Types.ObjectId; branchId?: Types.ObjectId; academicSessionId?: Types.ObjectId; studentId: string; batchId: string;
  periodType: "week" | "month"; periodStart: Date; comment: string;
}) {
  return StudentReportComment.create({
    ...input,
    authorId: context.actor.id,
    authorRole: context.actor.role === "admin" ? "admin" : "teacher",
  });
}
