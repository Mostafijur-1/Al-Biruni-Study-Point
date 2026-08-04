import mongoose from "mongoose";

import { McqExam } from "../lib/db/models/McqExam.ts";
import { MigrationRecord } from "../lib/db/models/MigrationRecord.ts";

const MIGRATION_ID = "20260804_phase1_additive_assessment_state";
const applyRequested = process.argv.includes("--apply");
const confirmation = process.argv.find((argument) => argument.startsWith("--confirm="))?.slice(10);

const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");

await mongoose.connect(uri);

try {
  const pendingFilter = {
    $or: [
      { version: { $exists: false } },
      { isArchived: { $exists: false } },
    ],
  };
  const pendingExams = await McqExam.countDocuments(pendingFilter);
  const existingRecord = await MigrationRecord.findOne({ migrationId: MIGRATION_ID }).lean();

  console.log(JSON.stringify({
    migrationId: MIGRATION_ID,
    mode: applyRequested ? "apply" : "dry-run",
    pendingExams,
    ledgerStatus: existingRecord?.status ?? "not-started",
  }, null, 2));

  if (!applyRequested) {
    console.log(`Dry run only. Use --apply --confirm=${MIGRATION_ID} after backup approval.`);
  } else {
    if (confirmation !== MIGRATION_ID) {
      throw new Error(`Apply requires --confirm=${MIGRATION_ID}.`);
    }
    if (existingRecord?.status === "completed") {
      console.log("Migration already completed; no changes applied.");
    } else {
      await MigrationRecord.findOneAndUpdate(
        { migrationId: MIGRATION_ID },
        {
          $set: { status: "running", startedAt: new Date() },
          $unset: { completedAt: 1, error: 1, summary: 1 },
        },
        { upsert: true, new: true },
      );

      try {
        const result = await McqExam.updateMany(
          pendingFilter,
          [
            {
              $set: {
                version: { $ifNull: ["$version", 0] },
                isArchived: { $ifNull: ["$isArchived", false] },
              },
            },
          ],
        );
        const summary = {
          matchedExams: result.matchedCount,
          modifiedExams: result.modifiedCount,
        };
        await MigrationRecord.updateOne(
          { migrationId: MIGRATION_ID },
          { $set: { status: "completed", completedAt: new Date(), summary } },
        );
        console.log(JSON.stringify({ migrationId: MIGRATION_ID, status: "completed", summary }, null, 2));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await MigrationRecord.updateOne(
          { migrationId: MIGRATION_ID },
          { $set: { status: "failed", completedAt: new Date(), error: message } },
        );
        throw error;
      }
    }
  }
} finally {
  await mongoose.disconnect();
}

