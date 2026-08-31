import mongoose from "mongoose";

import { applyWrittenExamBackfill, inspectWrittenExamBackfill, STEP7_WRITTEN_EXAM_MIGRATION_ID } from "../lib/db/written-exam-backfill.ts";

const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10);
const environment = process.argv.find((value) => value.startsWith("--environment="))?.slice(14);
const databaseName = process.argv.find((value) => value.startsWith("--database="))?.slice(11);
const limit = Number(process.argv.find((value) => value.startsWith("--limit="))?.slice(8) ?? "500");
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!environment || !["staging", "production", "test"].includes(environment)) throw new Error("Use an explicit --environment target.");
if (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName)) throw new Error("Use an explicit --database target.");
if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) throw new Error("Use a bounded --limit between 1 and 5000.");
if (apply && confirmation !== STEP7_WRITTEN_EXAM_MIGRATION_ID) throw new Error(`Apply requires --confirm=${STEP7_WRITTEN_EXAM_MIGRATION_ID}.`);

const connection = mongoose.createConnection(uri, { autoIndex: false, bufferCommands: false, dbName: databaseName, serverSelectionTimeoutMS: 15_000 });
try {
  await connection.asPromise();
  const db = connection.db;
  if (!db) throw new Error("MongoDB connection has no database handle.");
  const inspected = await inspectWrittenExamBackfill(db, limit);
  console.log(JSON.stringify({ migrationId: STEP7_WRITTEN_EXAM_MIGRATION_ID, environment, database: databaseName, mode: apply ? "apply" : "dry-run", ...inspected.report }, null, 2));
  if (!apply) console.log(`Dry run only. Apply requires --apply --confirm=${STEP7_WRITTEN_EXAM_MIGRATION_ID}.`);
  else {
    const result = await applyWrittenExamBackfill(db, limit);
    await db.collection("migrationrecords").updateOne({ migrationId: STEP7_WRITTEN_EXAM_MIGRATION_ID }, { $set: { status: "completed", environment, database: databaseName, completedAt: new Date(), result } }, { upsert: true });
    console.log(JSON.stringify({ migrationId: STEP7_WRITTEN_EXAM_MIGRATION_ID, status: "completed", result }, null, 2));
  }
} finally {
  await connection.close();
}
