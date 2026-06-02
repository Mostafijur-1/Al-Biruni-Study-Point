import type { StudentClass } from "@/types";

const STUDENT_CLASS_VALUES: StudentClass[] = [
  "class-9",
  "class-10",
  "class-11",
  "class-12",
];

export function normalizeTargetClasses(value: unknown): StudentClass[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is StudentClass =>
      typeof item === "string" &&
      STUDENT_CLASS_VALUES.includes(item as StudentClass),
  );
}

export function mapDocWithTargetClasses<T extends { _id: unknown; targetClasses?: unknown }>(
  doc: T,
) {
  return {
    ...doc,
    _id: String(doc._id),
    targetClasses: normalizeTargetClasses(doc.targetClasses),
  };
}
