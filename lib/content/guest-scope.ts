import { STUDENT_CLASSES, classFilterForStudent } from "./classes";
import type { StudentClass } from "@/types";

/** Client-safe helpers — do not import server/API modules here. */

export function parseGuestClassParam(value: string | null): StudentClass | null {
  if (!value || !STUDENT_CLASSES.includes(value as StudentClass)) {
    return null;
  }

  return value as StudentClass;
}

export function guestApiQuery(studentClass: StudentClass) {
  return `scope=guest&class=${studentClass}`;
}

export function applyGuestClassToQuery(
  guestClass: StudentClass,
  query: Record<string, unknown>,
  publishedField: "isPublished" | "status" = "isPublished",
) {
  if (publishedField === "status") {
    query.status = "published";
  } else {
    query.isPublished = true;
  }

  Object.assign(query, classFilterForStudent(guestClass));
}
