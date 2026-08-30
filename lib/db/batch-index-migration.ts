import type { Db } from "mongodb";

import {
  BATCH_SCOPE_CODE_INDEX,
  LEGACY_BATCH_SCOPE_INDEX_NAME,
  duplicateCandidatePipeline,
} from "./canonical-index-manifest.ts";

export const STEP2_INDEX_MIGRATION_ID = "20260830_step2_batch_scope_partial_unique";

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
        { branchId: { $exists: false } }, { branchId: null },
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
    legacyIndexPresent: indexes.some((index) => index.name === LEGACY_BATCH_SCOPE_INDEX_NAME),
    indexNames: indexes.map((index) => index.name).filter(Boolean).sort(),
  };
}

export async function applyBatchScopeIndexMigration(db: Db) {
  const before = await inspectBatchScopeIndexMigration(db);
  if (before.duplicateGroupCount > 0) {
    throw new Error("Canonical batch scope contains duplicate branch/session/code groups.");
  }
  const collection = db.collection(BATCH_SCOPE_CODE_INDEX.collection);
  await collection.createIndex(
    BATCH_SCOPE_CODE_INDEX.keys,
    BATCH_SCOPE_CODE_INDEX.options,
  );
  if (before.legacyIndexPresent) {
    await collection.dropIndex(LEGACY_BATCH_SCOPE_INDEX_NAME);
  }
  const after = await inspectBatchScopeIndexMigration(db);
  if (!after.desiredIndexPresent || after.legacyIndexPresent) {
    throw new Error("Batch scope index migration did not reach the expected state.");
  }
  return { before, after };
}
