import type { UserRole } from "../../types";

export type ResourceActor = {
  id: string;
  role: UserRole;
};

/**
 * Formal exam resources are global for admins, teacher-owned for teachers,
 * and never manageable by students. Keeping this decision pure makes the
 * default-deny behavior easy to exercise in the authorization matrix.
 */
export function canManageTeacherOwnedResource(
  actor: ResourceActor,
  ownerId: unknown,
): boolean {
  if (actor.role === "admin") return true;
  if (actor.role !== "teacher") return false;
  return actor.id === String(ownerId);
}

