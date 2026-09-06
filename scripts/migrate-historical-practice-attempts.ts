import mongoose from "mongoose";
import { applyHistoricalPracticeAttemptBackfill, HISTORICAL_PRACTICE_ATTEMPT_ID, inspectHistoricalPracticeAttemptBackfill } from "../lib/db/historical-practice-attempt-backfill.ts";

const value = (name: string) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const environment = value("environment");
const databaseName = value("database");
const limit = Number(value("limit") ?? "500");
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!environment || !["staging", "production", "test"].includes(environment)) throw new Error("Use an explicit --environment target.");
if (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName)) throw new Error("Use an explicit --database target.");
if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) throw new Error("Use a bounded --limit between 1 and 5000.");
if (apply && value("confirm") !== HISTORICAL_PRACTICE_ATTEMPT_ID) throw new Error(`Apply requires --confirm=${HISTORICAL_PRACTICE_ATTEMPT_ID}.`);
await mongoose.connect(uri, { dbName: databaseName, autoIndex: false, serverSelectionTimeoutMS: 15_000 });
try {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection has no database handle.");
  const inspected = await inspectHistoricalPracticeAttemptBackfill(db, limit);
  console.log(JSON.stringify({ migrationId: HISTORICAL_PRACTICE_ATTEMPT_ID, environment, database: databaseName, mode: apply ? "apply" : "dry-run", ...inspected.report }, null, 2));
  if (!apply) console.log(`Dry run only. Apply requires --apply --confirm=${HISTORICAL_PRACTICE_ATTEMPT_ID}.`);
  else console.log(JSON.stringify({ migrationId: HISTORICAL_PRACTICE_ATTEMPT_ID, status: "completed", result: await applyHistoricalPracticeAttemptBackfill(db, limit) }, null, 2));
} finally { await mongoose.disconnect(); }
