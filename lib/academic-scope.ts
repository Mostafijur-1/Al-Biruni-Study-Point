import type { UserRole } from "@/types";

export type AcademicBatchReadScope =
  | { kind: "all" }
  | { kind: "assigned"; batchIds: string[] };

export function resolveAcademicBatchReadScope(
  role: UserRole,
  teacherBatchIds: string[],
  studentBatchIds: string[],
): AcademicBatchReadScope {
  if (role === "admin") return { kind: "all" };

  const source = role === "teacher" ? teacherBatchIds : studentBatchIds;
  return { kind: "assigned", batchIds: [...new Set(source.map(String).filter(Boolean))] };
}
