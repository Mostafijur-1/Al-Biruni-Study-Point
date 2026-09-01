import mongoose from "mongoose";
import { rebuildReportingProjections } from "../lib/reporting/projection-service.ts";

export const STEP9_REPORTING_REBUILD_ID = "step9-reporting-projections-v1";
const value = (name: string) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
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
if (!apply || value("confirm") !== STEP9_REPORTING_REBUILD_ID) throw new Error(`A rebuild writes disposable projections and requires --apply --confirm=${STEP9_REPORTING_REBUILD_ID}.`);
await mongoose.connect(uri, { dbName: databaseName, autoIndex: false, serverSelectionTimeoutMS: 15_000 });
try {
  const result = await rebuildReportingProjections({ organizationId, branchId, date: new Date(`${dateText}T12:00:00+06:00`) });
  console.log(JSON.stringify({ rebuildId: STEP9_REPORTING_REBUILD_ID, environment, database: databaseName, ...result }, null, 2));
} finally { await mongoose.disconnect(); }
