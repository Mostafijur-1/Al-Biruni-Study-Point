import type { Schema } from "mongoose";

export const CANONICAL_AUTHORITY_ENV = "CANONICAL_ACADEMIC_AUTHORITY_ENABLED";

export function isCanonicalAcademicAuthorityEnabled(value = process.env[CANONICAL_AUTHORITY_ENV]) {
  return value?.trim().toLowerCase() === "true";
}

export function missingCanonicalPaths(
  value: Record<string, unknown>,
  requiredPaths: readonly string[],
) {
  return requiredPaths.filter((path) => value[path] === undefined || value[path] === null || value[path] === "");
}

export function requireCanonicalPathsWhenEnabled<T>(
  schema: Schema<T>,
  requiredPaths: readonly string[],
) {
  schema.pre("validate", function () {
    if (!isCanonicalAcademicAuthorityEnabled()) return;
    const document = this as unknown as Record<string, unknown> & {
      invalidate(path: string, message: string): void;
    };
    for (const path of missingCanonicalPaths(document, requiredPaths)) {
      document.invalidate(path, `${path} is required while canonical academic authority is enabled.`);
    }
  });
}
