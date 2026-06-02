import type { Model, Schema } from "mongoose";

/**
 * In Next.js dev, mongoose models can be cached without paths added after first compile.
 * Merges any missing paths from the canonical schema into the cached model.
 */
export function ensureSchemaPaths<T>(
  model: Model<T>,
  canonicalSchema: Schema<T>,
) {
  for (const pathName of Object.keys(canonicalSchema.paths)) {
    if (model.schema.path(pathName)) {
      continue;
    }

    const path = canonicalSchema.paths[pathName];
    model.schema.add({ [pathName]: path.options });
  }
}
