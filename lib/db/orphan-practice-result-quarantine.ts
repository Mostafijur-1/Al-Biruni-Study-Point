import { createHash } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";

export const ORPHAN_PRACTICE_RESULT_QUARANTINE_ID = "20260906_orphan_practice_results_quarantine_v1";
const ref = (id: unknown) => createHash("sha256").update(`practice-result:${String(id)}`).digest("hex").slice(0, 16);
const archiveId = (id: unknown) => new ObjectId(createHash("sha256").update(`quarantine:practice-result:${String(id)}`).digest("hex").slice(0, 24));

export async function inspectOrphanPracticeResults(db: Db, limit = 500) {
  const candidates = await db.collection("practiceresults")
    .find({ authoritativeAttempt: { $exists: false } })
    .limit(limit + 1)
    .toArray();
  if (candidates.length > limit) throw new Error(`Orphan practice results exceed the reviewed ${limit}-document bound.`);
  const studentIds = candidates.map((row) => row.student).filter(Boolean);
  const students = new Set((await db.collection("users")
    .find({ _id: { $in: studentIds } }, { projection: { _id: 1 } })
    .toArray()).map((row) => String(row._id)));
  const orphans = candidates.filter((row) => !row.student || !students.has(String(row.student)));
  const blocking = candidates.filter((row) => row.student && students.has(String(row.student)));
  return {
    orphans,
    report: {
      candidates: candidates.length,
      plannedQuarantine: orphans.length,
      blockingCount: blocking.length,
      blockingRefs: blocking.map((row) => ref(row._id)),
      orphanRefs: orphans.map((row) => ref(row._id)),
    },
  };
}

export async function applyOrphanPracticeResultQuarantine(db: Db, limit = 500) {
  const inspected = await inspectOrphanPracticeResults(db, limit);
  if (inspected.report.blockingCount) throw new Error("Live practice results without authority remain; quarantine is blocked.");
  if (!inspected.orphans.length) return { ...inspected.report, archived: 0, removedFromLiveProjection: 0 };
  const session = db.client.startSession();
  let archived = 0;
  let removedFromLiveProjection = 0;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const archive = await db.collection("legacyorphanrecords").bulkWrite(
        inspected.orphans.map((document: Document) => ({ updateOne: {
          filter: { _id: archiveId(document._id) },
          update: { $setOnInsert: { _id: archiveId(document._id), sourceCollection: "practiceresults", sourceId: document._id, reason: "student_missing", quarantinedAt: now, migrationId: ORPHAN_PRACTICE_RESULT_QUARANTINE_ID, document } },
          upsert: true,
        } })),
        { ordered: false, session },
      );
      archived = archive.upsertedCount;
      const removal = await db.collection("practiceresults").deleteMany(
        { _id: { $in: inspected.orphans.map((row) => row._id) }, authoritativeAttempt: { $exists: false } },
        { session },
      );
      removedFromLiveProjection = removal.deletedCount;
      if (removedFromLiveProjection !== inspected.orphans.length) throw new Error("Quarantine removal count did not match the reviewed plan.");
    });
  } finally { await session.endSession(); }
  return { ...inspected.report, archived, removedFromLiveProjection };
}
