import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import type { NextRequest } from "next/server";

import type { SessionUser } from "../../types";
import { AuditLog } from "../db/models/AuditLog";

type AuditInput = {
  request: NextRequest;
  actor: SessionUser;
  action: string;
  resourceType: string;
  resourceId: unknown;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export async function writeAuditLog(input: AuditInput) {
  return AuditLog.create({
    actor: new Types.ObjectId(input.actor.id),
    actorRole: input.actor.role,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: String(input.resourceId),
    reason: input.reason,
    requestId: getRequestId(input.request),
    before: input.before,
    after: input.after,
  });
}

