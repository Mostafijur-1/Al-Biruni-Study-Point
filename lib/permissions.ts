import type { Permission, UserRole } from "@/types";

export const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    "course:view",
    "course:enroll",
    "video:watch",
    "mcq:take",
    "cq:submit",
    "mcq:create",
    "video:upload",
    "cq:review",
    "student:manage",
    "teacher:approve",
    "course:manage",
    "analytics:view",
    "notes:upload",
  ],
  teacher: [
    "course:view",
    "video:watch",
    "mcq:create",
    "video:upload",
    "cq:review",
    "notes:upload",
  ],
  student: ["course:view", "course:enroll", "video:watch", "mcq:take", "cq:submit"],
};

export function can(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
