import { randomUUID } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import type { NextRequest } from "next/server";

import type { SessionUser } from "../../types";
import { AuditLog } from "../db/models/AuditLog.ts";

type AuditInput = {
  request: NextRequest;
  actor: SessionUser;
  organizationId?: unknown;
  branchId?: unknown;
  action: string;
  resourceType: string;
  resourceId: unknown;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  session?: ClientSession;
};

export function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export async function writeAuditLog(input: AuditInput) {
  const record = {
    organizationId: input.organizationId
      ? new Types.ObjectId(String(input.organizationId))
      : undefined,
    branchId: input.branchId ? new Types.ObjectId(String(input.branchId)) : undefined,
    actor: new Types.ObjectId(input.actor.id),
    actorRole: input.actor.role,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: String(input.resourceId),
    reason: input.reason,
    requestId: getRequestId(input.request),
    before: input.before,
    after: input.after,
  };

  if (input.session) {
    const [auditLog] = await AuditLog.create([record], { session: input.session });
    return auditLog;
  }

  return AuditLog.create(record);
}
