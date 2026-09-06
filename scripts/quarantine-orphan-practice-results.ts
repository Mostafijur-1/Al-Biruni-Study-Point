import mongoose from "mongoose";
import { applyOrphanPracticeResultQuarantine, inspectOrphanPracticeResults, ORPHAN_PRACTICE_RESULT_QUARANTINE_ID } from "../lib/db/orphan-practice-result-quarantine.ts";
const value = (name: string) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const environment = value("environment");
const databaseName = value("database");
const limit = Number(value("limit") ?? "500");
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!environment || !["staging", "production", "test"].includes(environment)) throw new Error("Use an explicit --environment target.");
if (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName)) throw new Error("Use an explicit --database target.");
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Use a bounded --limit between 1 and 500.");
if (apply && value("confirm") !== ORPHAN_PRACTICE_RESULT_QUARANTINE_ID) throw new Error(`Apply requires --confirm=${ORPHAN_PRACTICE_RESULT_QUARANTINE_ID}.`);
await mongoose.connect(uri, { dbName: databaseName, autoIndex: false, serverSelectionTimeoutMS: 15_000 });
try {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection has no database handle.");
  const inspected = await inspectOrphanPracticeResults(db, limit);
  console.log(JSON.stringify({ migrationId: ORPHAN_PRACTICE_RESULT_QUARANTINE_ID, environment, database: databaseName, mode: apply ? "apply" : "dry-run", ...inspected.report }, null, 2));
  if (!apply) console.log(`Dry run only. Apply requires --apply --confirm=${ORPHAN_PRACTICE_RESULT_QUARANTINE_ID}.`);
  else console.log(JSON.stringify({ migrationId: ORPHAN_PRACTICE_RESULT_QUARANTINE_ID, status: "completed", result: await applyOrphanPracticeResultQuarantine(db, limit) }, null, 2));
} finally { await mongoose.disconnect(); }
