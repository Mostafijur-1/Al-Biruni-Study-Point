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
    schoolCollege: doc.schoolCollege,
    isActive: doc.isActive,
    approvalStatus: doc.approvalStatus,
    reference: doc.reference,
    teacherDomain: doc.teacherDomain
      ? {
          isAll: !!doc.teacherDomain.isAll,
          classes: doc.teacherDomain.classes || [],
          subjects: (doc.teacherDomain.subjects || []).map((s: any) =>
            Array.isArray(s) ? String(s[0]) : String(s)
          ),
          students: (doc.teacherDomain.students || []).map((s: any) => String(s)),
        }
      : { isAll: false, classes: [], subjects: [], students: [] },
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
  };
}
