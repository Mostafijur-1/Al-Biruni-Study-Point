import { fail } from "@/lib/api/response";

import { applyGuestClassToQuery, parseGuestClassParam } from "./guest-scope";

export function applyGuestClassFilter(
  scope: string | null,
  classParam: string | null,
  query: Record<string, unknown>,
  publishedField: "isPublished" | "status" = "isPublished",
) {
  if (scope !== "guest") {
    return null;
  }

  const guestClass = parseGuestClassParam(classParam);

  if (!guestClass) {
    return fail("Class is required.", 400);
  }

  applyGuestClassToQuery(guestClass, query, publishedField);

  return null;
}
