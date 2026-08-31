import { ObjectId, type AnyBulkWriteOperation, type Db, type Document } from "mongodb";

export const STEP6_REFERENCE_MIGRATION_ID = "step6-assessment-reference-backfill-v1";

type ReferenceUpdate = { collection: string; id: ObjectId; set: Record<string, ObjectId | number> };

export async function inspectAssessmentReferenceBackfill(db: Db, limit = 500) {
  const updates: ReferenceUpdate[] = [];
  const questions = await db.collection("questions").find({ latestPublishedVersion: { $type: "objectId" }, "legacySource.collection": { $in: ["McqQuestion", "PracticeQuestion"] }, "legacySource.id": { $type: "string" } }).limit(limit).toArray();
  for (const question of questions) {
    if (!ObjectId.isValid(question.legacySource.id)) continue;
    updates.push({ collection: question.legacySource.collection === "McqQuestion" ? "mcqquestions" : "practicequestions", id: new ObjectId(question.legacySource.id), set: { questionId: question._id, questionVersionId: question.latestPublishedVersion } });
  }
  const assessments = await db.collection("assessments").find({ latestPublishedVersion: { $type: "objectId" }, "legacySource.collection": "McqExam", "legacySource.id": { $type: "string" } }).limit(limit).toArray();
  for (const assessment of assessments) {
    if (!ObjectId.isValid(assessment.legacySource.id)) continue;
    updates.push({ collection: "mcqexams", id: new ObjectId(assessment.legacySource.id), set: { assessmentId: assessment._id, assessmentVersionId: assessment.latestPublishedVersion } });
  }
  const kernelAttempts = await db.collection("assessmentattempts").find({ "legacySource.collection": "AttemptSession", "legacySource.id": { $type: "string" } }).limit(limit).toArray();
  for (const attempt of kernelAttempts) {
    if (!ObjectId.isValid(attempt.legacySource.id)) continue;
    const sessionId = new ObjectId(attempt.legacySource.id);
    const [formal, practice] = await Promise.all([
      db.collection("mcqexamattempts").findOne({ attemptSession: sessionId }, { projection: { _id: 1 } }),
      db.collection("practiceattempts").findOne({ attemptSession: sessionId }, { projection: { _id: 1 } }),
    ]);
    if (formal) updates.push({ collection: "mcqexamattempts", id: formal._id, set: { assessmentAttemptId: attempt._id } });
    if (practice) updates.push({ collection: "practiceattempts", id: practice._id, set: { assessmentAttemptId: attempt._id } });
  }
  const practiceAttempts = await db.collection("practiceattempts").find({ attemptSession: { $type: "objectId" } }).limit(limit).toArray();
  for (const attempt of practiceAttempts) {
    const result = await db.collection("practiceresults").findOne({ attemptSession: attempt.attemptSession }, { projection: { _id: 1 } });
    if (result) updates.push({ collection: "practiceresults", id: result._id, set: { authoritativeAttempt: attempt._id, projectionVersion: 1 } });
  }
  return { updates, report: { plannedTotal: updates.length, byCollection: Object.fromEntries([...new Set(updates.map((row) => row.collection))].map((collection) => [collection, updates.filter((row) => row.collection === collection).length])) } };
}

export async function applyAssessmentReferenceBackfill(db: Db, limit = 500) {
  const { updates, report } = await inspectAssessmentReferenceBackfill(db, limit);
  let modifiedTotal = 0;
  for (const collection of new Set(updates.map((row) => row.collection))) {
    const operations: AnyBulkWriteOperation<Document>[] = updates.filter((row) => row.collection === collection).map((row) => ({ updateOne: { filter: { _id: row.id }, update: { $set: row.set } } }));
    if (operations.length) modifiedTotal += (await db.collection(collection).bulkWrite(operations, { ordered: false })).modifiedCount;
  }
  return { ...report, modifiedTotal };
}
