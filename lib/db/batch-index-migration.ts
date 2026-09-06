import type { Db } from "mongodb";

import {
  BATCH_SCOPE_CODE_INDEX,
  BATCH_STATUS_INDEX,
  LEGACY_BATCH_SCOPE_INDEX_NAMES,
  duplicateCandidatePipeline,
} from "./canonical-index-manifest.ts";

export const STEP2_INDEX_MIGRATION_ID = "20260906_batch_organization_indexes_v2";

export async function inspectBatchScopeIndexMigration(db: Db) {
  const collection = db.collection(BATCH_SCOPE_CODE_INDEX.collection);
  const [indexes, duplicateRows, missingCanonicalFields] = await Promise.all([
    collection.listIndexes().toArray().catch(() => []),
    collection.aggregate<{
      duplicateGroupCount: number;
      affectedDocumentCount: number;
    }>(duplicateCandidatePipeline(BATCH_SCOPE_CODE_INDEX)).toArray(),
    collection.countDocuments({
      $or: [
        { organizationId: { $exists: false } }, { organizationId: null },
        { academicSessionId: { $exists: false } }, { academicSessionId: null },
        { code: { $exists: false } }, { code: null }, { code: "" },
      ],
    }),
  ]);
  const duplicate = duplicateRows[0];
  return {
    duplicateGroupCount: duplicate?.duplicateGroupCount ?? 0,
    affectedDocumentCount: duplicate?.affectedDocumentCount ?? 0,
    missingCanonicalFields,
    desiredIndexPresent: indexes.some((index) => index.name === BATCH_SCOPE_CODE_INDEX.options.name),
    desiredStatusIndexPresent: indexes.some((index) => index.name === BATCH_STATUS_INDEX.options.name),
    legacyIndexNames: indexes
      .map((index) => index.name)
      .filter((name): name is string => Boolean(name) && LEGACY_BATCH_SCOPE_INDEX_NAMES.includes(name as typeof LEGACY_BATCH_SCOPE_INDEX_NAMES[number])),
    indexNames: indexes.map((index) => index.name).filter(Boolean).sort(),
  };
}

export async function applyBatchScopeIndexMigration(db: Db) {
  const before = await inspectBatchScopeIndexMigration(db);
  if (before.duplicateGroupCount > 0) {
    throw new Error("Canonical batch scope contains duplicate organization/session/code groups.");
  }
  const collection = db.collection(BATCH_SCOPE_CODE_INDEX.collection);
  await collection.createIndex(
    BATCH_SCOPE_CODE_INDEX.keys,
    BATCH_SCOPE_CODE_INDEX.options,
  );
  await collection.createIndex(BATCH_STATUS_INDEX.keys, BATCH_STATUS_INDEX.options);
  for (const indexName of before.legacyIndexNames) {
    await collection.dropIndex(indexName);
  }
  const after = await inspectBatchScopeIndexMigration(db);
  if (!after.desiredIndexPresent || !after.desiredStatusIndexPresent || after.legacyIndexNames.length > 0) {
    throw new Error("Batch scope index migration did not reach the expected state.");
  }
  return { before, after };
}
