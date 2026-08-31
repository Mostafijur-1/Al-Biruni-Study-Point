import type { QueryFilter } from "mongoose";

import { DomainError } from "@/lib/application/domain-error";
import type { CanonicalRequestScope } from "@/lib/application/request-context";
import type { SessionUser } from "@/types";
import { canAccessResource, type ResourceAccess } from "@/lib/application/resource-access";

export { canAccessResource, type ResourceAccess } from "@/lib/application/resource-access";

export function canonicalScopeFilter<T>(scope: CanonicalRequestScope): QueryFilter<T> {
  const filter: Record<string, string> = {};
  if (scope.organizationId) filter.organizationId = scope.organizationId;
  if (scope.branchId) filter.branchId = scope.branchId;
  if (scope.academicSessionId) filter.academicSessionId = scope.academicSessionId;
  return filter as QueryFilter<T>;
}

export function assertResourceAccess(actor: SessionUser, resource: ResourceAccess, message = "Forbidden") {
  if (!canAccessResource(actor, resource)) throw new DomainError(message, 403, "FORBIDDEN");
}

export function assertAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw new DomainError("Forbidden", 403, "FORBIDDEN");
}
