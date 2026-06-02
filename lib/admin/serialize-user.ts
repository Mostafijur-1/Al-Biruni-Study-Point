import type { IUser } from "@/lib/db/models/User";

export function serializeAdminUser(user: IUser | Record<string, unknown>) {
  const doc = user as IUser;

  return {
    id: String(doc._id),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    role: doc.role,
    studentClass: doc.studentClass,
    isActive: doc.isActive,
    approvalStatus: doc.approvalStatus,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
  };
}
