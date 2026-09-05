import { createHash } from "node:crypto";
import type { Db, Document, ObjectId } from "mongodb";

export const SINGLE_ORGANIZATION_BACKFILL_ID = "20260905_single_organization_scope_v1";

type PlannedUpdate = { id: ObjectId; set: Record<string, unknown> };

function ref(collection: string, id: unknown) {
  return createHash("sha256").update(`${collection}:${String(id)}`).digest("hex").slice(0, 16);
}

export function inferBatchStudentClass(name: unknown) {
  const normalized = String(name ?? "").trim().toUpperCase();
  if (normalized.includes("SSC")) return "class-10" as const;
  if (normalized.includes("HSC")) return "class-11" as const;
  return undefined;
}

export async function inspectSingleOrganizationBackfill(db: Db, limit = 5_000) {
  const [organizations, sessions] = await Promise.all([
    db.collection("organizations").find({ status: "active" }, { projection: { _id: 1 } }).limit(2).toArray(),
    db.collection("academicsessions").find({ status: "active" }, { projection: { _id: 1, organizationId: 1 } }).limit(2).toArray(),
  ]);
  if (organizations.length !== 1) throw new Error("Single-organization backfill requires exactly one active organization.");
  const organizationId = organizations[0]._id as ObjectId;
  const matchingSessions = sessions.filter((row) => String(row.organizationId) === String(organizationId));
  if (matchingSessions.length !== 1) throw new Error("Single-organization backfill requires exactly one active academic session for the organization.");
  const academicSessionId = matchingSessions[0]._id as ObjectId;
  const updates = new Map<string, PlannedUpdate[]>();
  const exceptions: Array<{ collection: string; ref: string; reason: string }> = [];
  const plan = (collection: string, id: ObjectId, set: Record<string, unknown>) => {
    if (Object.keys(set).length) updates.set(collection, [...(updates.get(collection) ?? []), { id, set }]);
  };

  const batches = await db.collection("batches").find({}).limit(limit).toArray();
  const prospectiveBatches = new Map<string, Document>();
  for (const batch of batches) {
    if (batch.organizationId && String(batch.organizationId) !== String(organizationId)) {
      exceptions.push({ collection: "batches", ref: ref("batches", batch._id), reason: "organization_scope_conflict" });
      continue;
    }
    if (batch.academicSessionId && String(batch.academicSessionId) !== String(academicSessionId)) {
      exceptions.push({ collection: "batches", ref: ref("batches", batch._id), reason: "academic_session_scope_conflict" });
      continue;
    }
    const studentClass = batch.studentClass ?? inferBatchStudentClass(batch.name);
    if (!studentClass) {
      exceptions.push({ collection: "batches", ref: ref("batches", batch._id), reason: "student_class_cannot_be_inferred" });
      continue;
    }
    const set = {
      ...(!batch.organizationId ? { organizationId } : {}),
      ...(!batch.academicSessionId ? { academicSessionId } : {}),
      ...(!batch.studentClass ? { studentClass } : {}),
    };
    plan("batches", batch._id, set);
    prospectiveBatches.set(String(batch._id), { ...batch, ...set });
  }

  const enrollments = await db.collection("batchenrollments").find({}).limit(limit).toArray();
  for (const enrollment of enrollments) {
    const batch = prospectiveBatches.get(String(enrollment.batchId));
    if (!batch) {
      exceptions.push({ collection: "batchenrollments", ref: ref("batchenrollments", enrollment._id), reason: "scoped_batch_missing" });
      continue;
    }
    if ((enrollment.organizationId && String(enrollment.organizationId) !== String(organizationId)) || (enrollment.academicSessionId && String(enrollment.academicSessionId) !== String(academicSessionId))) {
      exceptions.push({ collection: "batchenrollments", ref: ref("batchenrollments", enrollment._id), reason: "scope_conflict" });
      continue;
    }
    plan("batchenrollments", enrollment._id, {
      ...(!enrollment.organizationId ? { organizationId } : {}),
      ...(!enrollment.academicSessionId ? { academicSessionId } : {}),
    });
  }

  for (const collection of ["monthlypayments", "monthlyexpenses", "paymentprofiles"] as const) {
    const rows = await db.collection(collection).find({ $or: [{ organizationId: { $exists: false } }, { organizationId: null }] }).limit(limit).toArray();
    for (const row of rows) plan(collection, row._id, { organizationId });
  }

  return {
    updates,
    report: {
      organizationId: String(organizationId),
      academicSessionId: String(academicSessionId),
      scannedLimitPerCollection: limit,
      plannedByCollection: Object.fromEntries([...updates].map(([collection, rows]) => [collection, rows.length])),
      plannedTotal: [...updates.values()].reduce((sum, rows) => sum + rows.length, 0),
      exceptionCount: exceptions.length,
      exceptions,
    },
  };
}

export async function applySingleOrganizationBackfill(db: Db, limit = 5_000) {
  const inspected = await inspectSingleOrganizationBackfill(db, limit);
  if (inspected.report.exceptionCount) throw new Error("Single-organization scope backfill has unresolved exceptions.");
  let modifiedTotal = 0;
  for (const [collection, rows] of inspected.updates) {
    if (!rows.length) continue;
    const result = await db.collection(collection).bulkWrite(rows.map((row) => ({ updateOne: { filter: { _id: row.id }, update: { $set: row.set } } })), { ordered: false });
    modifiedTotal += result.modifiedCount;
  }
  return { ...inspected.report, modifiedTotal };
}
