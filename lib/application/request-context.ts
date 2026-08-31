import type { NextRequest } from "next/server";

import { createRequestId } from "@/lib/api-error";
import type { SessionUser } from "@/types";

export type CanonicalRequestScope = {
  organizationId?: string;
  branchId?: string;
  academicSessionId?: string;
};

export type RequestContext = {
  actor: SessionUser;
  request: NextRequest;
  requestId: string;
  scope: CanonicalRequestScope;
};

export function createRequestContext(request: NextRequest, actor: SessionUser, scope: CanonicalRequestScope = {}): RequestContext {
  return { actor, request, requestId: request.headers.get("x-request-id")?.trim() || createRequestId(), scope };
}
