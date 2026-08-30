import assert from "node:assert/strict";

import mongoose from "mongoose";

import {
  applyBatchScopeIndexMigration,
  inspectBatchScopeIndexMigration,
} from "../lib/db/batch-index-migration.ts";
import {
  BATCH_SCOPE_CODE_INDEX,
  LEGACY_BATCH_SCOPE_INDEX_NAME,
} from "../lib/db/canonical-index-manifest.ts";

const uri = process.env.ACADEMIC_TEST_MONGODB_URI?.trim();
const dbName = process.env.ACADEMIC_TEST_DB_NAME?.trim();
if (!uri) throw new Error("ACADEMIC_TEST_MONGODB_URI is required.");
if (!dbName || !/^absp_[a-z0-9_-]*test$/i.test(dbName) || dbName.toLowerCase() === "absp") {
  throw new Error("ACADEMIC_TEST_DB_NAME must be an explicit absp_*test database.");
}

const connection = mongoose.createConnection(uri, { autoIndex: false, dbName });
await connection.asPromise();
const database = connection.db;
if (!database) throw new Error("MongoDB connection has no database handle.");
const batches = database.collection("batches");
const fixture = (name: string) => ({
  name,
  mode: "offline",
  defaultFeeTk: 0,
  activeEnrollmentCount: 0,
  status: "planned",
  createdAt: new Date(),
  updatedAt: new Date(),
});
const canonical = (code: string) => ({
  ...fixture(`Canonical ${code}`),
  branchId: new mongoose.Types.ObjectId("64b000000000000000000001"),
  academicSessionId: new mongoose.Types.ObjectId("64b000000000000000000002"),
  code,
});

try {
  const hello = await database.admin().command({ hello: 1 });
  assert.ok(hello.setName || hello.msg === "isdbgrid", "A transaction-capable MongoDB topology is required.");

  // Fresh database: incomplete legacy rows coexist, canonical scope stays unique.
  await batches.drop().catch(() => undefined);
  await batches.createIndex(BATCH_SCOPE_CODE_INDEX.keys, BATCH_SCOPE_CODE_INDEX.options);
  await batches.insertMany([fixture("Legacy A"), fixture("Legacy B")]);
  await batches.insertOne(canonical("B-1"));
  await assert.rejects(batches.insertOne(canonical("B-1")), /duplicate key/i);
  let state = await inspectBatchScopeIndexMigration(database);
  assert.equal(state.desiredIndexPresent, true);
  assert.equal(state.legacyIndexPresent, false);
  assert.equal(state.missingCanonicalFields, 2);

  // Migrated fixture: create the replacement first, then remove the legacy index.
  await batches.drop();
  await batches.createIndex(
    BATCH_SCOPE_CODE_INDEX.keys,
    { name: LEGACY_BATCH_SCOPE_INDEX_NAME, unique: true },
  );
  await batches.insertOne(fixture("Legacy fixture"));
  state = await inspectBatchScopeIndexMigration(database);
  assert.equal(state.legacyIndexPresent, true);
  await applyBatchScopeIndexMigration(database);
  state = await inspectBatchScopeIndexMigration(database);
  assert.equal(state.desiredIndexPresent, true);
  assert.equal(state.legacyIndexPresent, false);

  // Unsafe fixture: preflight blocks canonical duplicates before any index change.
  await batches.drop();
  await batches.insertMany([canonical("DUP"), canonical("DUP")]);
  state = await inspectBatchScopeIndexMigration(database);
  assert.equal(state.duplicateGroupCount, 1);
  assert.equal(state.affectedDocumentCount, 2);
  await assert.rejects(
    applyBatchScopeIndexMigration(database),
    /duplicate branch\/session\/code groups/,
  );

  console.log(JSON.stringify({
    status: "passed",
    database: dbName,
    scenarios: ["fresh", "migrated", "duplicate-blocked"],
  }, null, 2));
} finally {
  await batches.drop().catch(() => undefined);
  await connection.close();
}
