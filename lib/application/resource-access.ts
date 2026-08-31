export type AccessActor = { id: string; role: "admin" | "teacher" | "student" };
export type ResourceAccess = { ownerId?: string; assignedActorIds?: string[] };

export function canAccessResource(actor: AccessActor, resource: ResourceAccess) {
  if (actor.role === "admin") return true;
  if (actor.role === "student") return resource.ownerId === actor.id;
  return resource.assignedActorIds?.includes(actor.id) ?? false;
}
