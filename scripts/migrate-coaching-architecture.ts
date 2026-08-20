import mongoose from "mongoose";

import { connectDB } from "../lib/db/connect.ts";
import { AcademicSubject } from "../lib/db/models/AcademicSubject.ts";
import { Batch } from "../lib/db/models/Batch.ts";
import { BatchEnrollment } from "../lib/db/models/BatchEnrollment.ts";
import { CoachingBatchSubject } from "../lib/db/models/CoachingBatchSubject.ts";
import { CoachingEnrollmentSubject } from "../lib/db/models/CoachingEnrollmentSubject.ts";
import { MigrationRecord } from "../lib/db/models/MigrationRecord.ts";
import { RoutineSlot } from "../lib/db/models/RoutineSlot.ts";
import { User } from "../lib/db/models/User.ts";

const migrationId = "2026-08-coaching-enrollment-subjects-v1";
const apply = process.argv.includes("--apply");
const actorId = process.argv.find((argument) => argument.startsWith("--actor="))?.slice("--actor=".length);
const configuredSubjectNames = new Set(["PHYSICS", "CHEMISTRY", "HIGHER MATH", "ICT"]);

function normalizedName(value: string) { return value.trim().toUpperCase(); }

await connectDB();
if (apply && (!actorId || !mongoose.isValidObjectId(actorId) || !(await User.exists({ _id: actorId, role: "admin", isActive: true })))) {
  throw new Error("Apply requires --actor=<active-admin-object-id> for auditable createdBy fields.");
}
const alreadyApplied = await MigrationRecord.exists({ migrationId, status: "completed" });
if (alreadyApplied) throw new Error(`${migrationId} is already completed.`);

const batches = await Batch.find({
  studentClass: { $in: ["class-11", "class-12"] },
  $or: [{ name: /2028/i }, { code: /2028/i }],
}).lean();
const summary = {
  mode: apply ? "apply" : "dry-run",
  candidateBatches: batches.length,
  configuredBatches: 0,
  migratedEnrollments: 0,
  legacyRoutinesPreserved: 0,
  unresolved: [] as string[],
};

for (const batch of batches) {
  const subjects = await AcademicSubject.find({
    organizationId: batch.organizationId,
    status: "active",
    classLevels: batch.studentClass,
  }).lean();
  const matches = subjects.filter((subject) => configuredSubjectNames.has(normalizedName(subject.name)));
  if (matches.length !== configuredSubjectNames.size) {
    summary.unresolved.push(`Batch ${batch.code}: expected exact Physics, Chemistry, Higher Math and ICT subject definitions; found ${matches.length}.`);
    continue;
  }
  summary.configuredBatches += 1;
  if (!apply) continue;
  await Promise.all(matches.map((subject, sortOrder) => CoachingBatchSubject.findOneAndUpdate(
    { batchId: batch._id, subjectId: subject._id },
    { $setOnInsert: { organizationId: batch.organizationId, branchId: batch.branchId, createdBy: actorId }, $set: { status: "active", sortOrder } },
    { upsert: true, runValidators: true },
  )));
  const enrollments = await BatchEnrollment.find({ batchId: batch._id, status: "active" });
  for (const enrollment of enrollments) {
    const existing = await CoachingEnrollmentSubject.exists({ enrollmentId: enrollment._id });
    if (existing) continue;
    await CoachingEnrollmentSubject.insertMany(matches.map((subject) => ({
      organizationId: enrollment.organizationId, branchId: enrollment.branchId, batchId: enrollment.batchId,
      enrollmentId: enrollment._id, studentId: enrollment.studentId, subjectId: subject._id,
      status: "active", effectiveFrom: enrollment.effectiveFrom, createdBy: enrollment.createdBy,
    })));
    await enrollment.save();
    summary.migratedEnrollments += 1;
  }
}

summary.legacyRoutinesPreserved = await RoutineSlot.countDocuments({ studentIds: { $exists: true, $ne: [] } });
if (apply) await MigrationRecord.create({ migrationId, status: "completed", completedAt: new Date(), summary });
console.log(JSON.stringify(summary, null, 2));
await mongoose.disconnect();
