import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BATCH_SCOPE_CODE_INDEX,
  canonicalIntegrityIndexManifest,
  duplicateCandidatePipeline,
  LEGACY_BATCH_SCOPE_INDEX_NAME,
} from "../lib/db/canonical-index-manifest.ts";
import { Batch } from "../lib/db/models/Batch.ts";

test("canonical integrity indexes use stable unique identifiers", () => {
  assert.equal(new Set(canonicalIntegrityIndexManifest.map((index) => index.id)).size, canonicalIntegrityIndexManifest.length);
  assert.equal(BATCH_SCOPE_CODE_INDEX.options.name, "uq_batch_scope_code_canonical");
  assert.equal(LEGACY_BATCH_SCOPE_INDEX_NAME, "branchId_1_academicSessionId_1_code_1");
});

test("batch scope uniqueness applies only to fully canonical batches", () => {
  assert.deepEqual(BATCH_SCOPE_CODE_INDEX.options.partialFilterExpression, {
    branchId: { $type: "objectId" },
    academicSessionId: { $type: "objectId" },
    code: { $type: "string" },
  });
  const schemaIndex = Batch.schema.indexes().find((index: [
    Record<string, unknown>,
    { name?: string; unique?: boolean; partialFilterExpression?: unknown },
  ]) => index[1].name === BATCH_SCOPE_CODE_INDEX.options.name);
  assert.ok(schemaIndex);
  assert.equal(schemaIndex[1].unique, true);
  assert.deepEqual(schemaIndex[1].partialFilterExpression, BATCH_SCOPE_CODE_INDEX.options.partialFilterExpression);
});

test("duplicate preflight returns counts without duplicate key values", () => {
  const pipeline = duplicateCandidatePipeline(BATCH_SCOPE_CODE_INDEX);
  assert.match(JSON.stringify(pipeline), /duplicateGroupCount/);
  assert.match(JSON.stringify(pipeline), /affectedDocumentCount/);
  assert.equal(JSON.stringify(pipeline).includes("$out"), false);
  assert.equal(JSON.stringify(pipeline).includes("$merge"), false);
});

test("the Step 2 migration is dry-run first and confirmation guarded", async () => {
  const source = await readFile("scripts/migrate-step2-scope-indexes.ts", "utf8");
  assert.match(source, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(source, /Apply requires --confirm=/);
  assert.match(source, /explicit --database=<database-name> target/);
  assert.match(source, /duplicateGroupCount > 0/);
  assert.match(source, /autoIndex: false/);
});
