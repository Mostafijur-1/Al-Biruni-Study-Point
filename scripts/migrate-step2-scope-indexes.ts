import mongoose from "mongoose";

import {
  applyBatchScopeIndexMigration,
  inspectBatchScopeIndexMigration,
  STEP2_INDEX_MIGRATION_ID,
} from "../lib/db/batch-index-migration.ts";

const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10);
const environment = process.argv.find((value) => value.startsWith("--environment="))?.slice(14);
const databaseName = process.argv.find((value) => value.startsWith("--database="))?.slice(11);
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!environment || !["staging", "production", "test"].includes(environment)) {
  throw new Error("Use --environment=staging, --environment=production, or --environment=test.");
}
if (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName)) {
  throw new Error("Use an explicit --database=<database-name> target.");
}
if (apply && confirmation !== STEP2_INDEX_MIGRATION_ID) {
  throw new Error(`Apply requires --confirm=${STEP2_INDEX_MIGRATION_ID}.`);
}

const connection = mongoose.createConnection(uri, {
  autoIndex: false,
  bufferCommands: false,
  dbName: databaseName,
  serverSelectionTimeoutMS: 15_000,
});

try {
  await connection.asPromise();
  const db = connection.db;
  if (!db) throw new Error("MongoDB connection has no database handle.");
  const before = await inspectBatchScopeIndexMigration(db);
  const report = {
    migrationId: STEP2_INDEX_MIGRATION_ID,
    environment,
    database: databaseName,
    mode: apply ? "apply" : "dry-run",
    status: before.duplicateGroupCount > 0 ? "blocked" : "ready",
    before,
    plannedOperations: [
      "Create the named partial unique canonical batch scope index.",
      "Drop the legacy unconditional unique batch scope index after successful creation.",
    ],
    rollback: "Retain the partial unique index. A compatibility non-unique index may be added only after a separate reviewed query-plan check.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (before.duplicateGroupCount > 0) process.exitCode = 1;
  else if (!apply) console.log(`Dry run only. Apply requires --apply --confirm=${STEP2_INDEX_MIGRATION_ID}.`);
  else {
    const ledger = db.collection("migrationrecords");
    const completed = await ledger.findOne({ migrationId: STEP2_INDEX_MIGRATION_ID, status: "completed" });
    if (completed) console.log("Migration already completed; no index changes applied.");
    else {
      await ledger.updateOne(
        { migrationId: STEP2_INDEX_MIGRATION_ID },
        { $set: { status: "running", startedAt: new Date(), updatedAt: new Date() }, $unset: { completedAt: "", error: "", summary: "" } },
        { upsert: true },
      );
      try {
        const result = await applyBatchScopeIndexMigration(db);
        await ledger.updateOne(
          { migrationId: STEP2_INDEX_MIGRATION_ID },
          { $set: { status: "completed", completedAt: new Date(), updatedAt: new Date(), summary: result.after } },
        );
        console.log(JSON.stringify({ migrationId: STEP2_INDEX_MIGRATION_ID, status: "completed", after: result.after }, null, 2));
      } catch (error) {
        await ledger.updateOne(
          { migrationId: STEP2_INDEX_MIGRATION_ID },
          { $set: { status: "failed", completedAt: new Date(), updatedAt: new Date(), error: error instanceof Error ? error.message : "Index migration failed." } },
        );
        throw error;
      }
    }
  }
} finally {
  await connection.close();
}
