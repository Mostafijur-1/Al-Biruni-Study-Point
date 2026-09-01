import mongoose from "mongoose";
import { ReportingProjection } from "../lib/db/models/ReportingProjection.ts";
import { reconcileReportingProjections } from "../lib/reporting/projection-service.ts";

const value = (name: string) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const environment = value("environment");
const databaseName = value("database");
const organizationId = value("organization");
const branchId = value("branch");
const dateText = value("date");
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!environment || !["staging", "production", "test"].includes(environment)) throw new Error("Use an explicit --environment target.");
if (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName)) throw new Error("Use an explicit --database target.");
if (!organizationId || !mongoose.isObjectIdOrHexString(organizationId) || !branchId || !mongoose.isObjectIdOrHexString(branchId)) throw new Error("Use explicit valid --organization and --branch IDs.");
if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error("Use an explicit --date=YYYY-MM-DD.");
await mongoose.connect(uri, { dbName: databaseName, autoIndex: false, serverSelectionTimeoutMS: 15_000 });
try {
  const reconciliation = await reconcileReportingProjections({ organizationId, branchId, date: new Date(`${dateText}T12:00:00+06:00`) });
  const explain = await ReportingProjection.collection.find({ organizationId: new mongoose.Types.ObjectId(organizationId), branchId: new mongoose.Types.ObjectId(branchId), projectionType: "student-today", periodKey: reconciliation.dayKey }).sort({ _id: -1 }).limit(100).explain("executionStats");
  console.log(JSON.stringify({ environment, database: databaseName, reconciliation, queryEvidence: { executionStats: explain.executionStats, queryPlanner: explain.queryPlanner } }, null, 2));
  if (!reconciliation.matches) process.exitCode = 2;
} finally { await mongoose.disconnect(); }
