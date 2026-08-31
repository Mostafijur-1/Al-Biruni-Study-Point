import mongoose from "mongoose";

import { reconcilePracticeResultProjections } from "../lib/mcq/practice-result-projection.ts";

const apply = process.argv.includes("--apply");
const databaseName = process.argv.find((value) => value.startsWith("--database="))?.slice(11);
const limit = Number(process.argv.find((value) => value.startsWith("--limit="))?.slice(8) ?? "500");
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName)) throw new Error("Use an explicit --database target.");
if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) throw new Error("Use a bounded --limit between 1 and 5000.");
if (!apply) throw new Error("Projection rebuild requires the explicit --apply flag.");

await mongoose.connect(uri, { dbName: databaseName, autoIndex: false, bufferCommands: false });
try {
  console.log(JSON.stringify(await reconcilePracticeResultProjections({ limit }), null, 2));
} finally {
  await mongoose.disconnect();
}
